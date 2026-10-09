// Blackmagic Design Streaming Encoders

import { InstanceBase, InstanceStatus, Regex, runEntrypoint, TCPHelper } from '@companion-module/base'
import { updateActions } from './actions.js'
import { updateFeedbacks } from './feedback.js'
import { updatePresets } from './presets.js'
import { updateVariables } from './variables.js'

const IDLE_POLL = 5000
const RECONNECT_MIN = 15000
const RECONNECT_MAX = 60000
const SILENT_MESSAGE = 'Device is not responding - it may need a power cycle'

class WebPresenter extends InstanceBase {
	constructor(internal) {
		super(internal)

		this.updateActions = updateActions.bind(this)
		this.updateFeedbacks = updateFeedbacks.bind(this)
		this.updatePresets = updatePresets.bind(this)
		this.updateVariables = updateVariables.bind(this)
	}

	getConfigFields() {
		return [
			{
				type: 'static-text',
				id: 'info',
				label: 'Information',
				value: 'This module will allow you to control the Blackmagic Web Presenter or Streaming Encoder.',
			},
			{
				type: 'textinput',
				id: 'host',
				label: 'Device IP',
				regex: Regex.IP,
			},
			{
				type: 'textinput',
				id: 'port',
				label: 'Device Port',
				default: '9977',
				regex: Regex.Port,
			},
		]
	}

	async destroy() {
		this.stopPolling()

		if (this.socket !== undefined) {
			this.socket.destroy()
		}
	}

	async init(config) {
		this.config = config
		this.request_id = 0
		this.stash = []
		this.command = null
		this.formats = []
		this.quality = []
		this.platforms = []
		this.customPlatforms = []
		this.timer = undefined
		this.poll = false
		this.lastData = 0
		this.lastReconnect = 0
		this.reconnectDelay = RECONNECT_MIN
		this.silent = false
		this.lastPoll = 0
		this.traceUntil = 0

		this.updateActions()
		this.updateVariables()
		this.updateFeedbacks()
		this.updatePresets()

		this.initTCP()
	}

	initTCP() {
		this.log('debug', 'initTCP ' + this.config.host + ':' + this.config.port)

		this.resetParser()
		this.stopPolling()

		if (this.socket !== undefined) {
			this.socket.destroy()
			delete this.socket
		}

		if (!this.config.host) {
			this.updateStatus(InstanceStatus.BadConfig, 'Device IP is not set')
			return
		}

		{
			this.socket = new TCPHelper(this.config.host, this.config.port || 9977)

			this.socket.on('status_change', (status, message) => {
				if (status === InstanceStatus.Ok && this.silent) {
					// connected, but the device still isn't talking: don't show a misleading green status
					this.updateStatus(InstanceStatus.ConnectionFailure, SILENT_MESSAGE)
				} else {
					this.updateStatus(status, message)
				}
				if (status !== InstanceStatus.Ok) {
					// connection lost: stop polling and throw away any half-received reply
					this.stopPolling()
					this.resetParser()
				}
			})

			this.socket.on('error', (err) => {
				this.log('error', 'Network error: ' + err.message)
				this.updateStatus(InstanceStatus.ConnectionFailure, err.message)
				this.stopPolling()
			})

			this.socket.on('connect', () => {
				this.log('info', 'Connected to device')
				this.lastData = Date.now()
				this.resetParser()
				// always make sure only ONE poll timer exists, even after many reconnects
				this.stopPolling()
				this.poll = true
				this.timer = setInterval(this.dataPoller.bind(this), 1000)
			})

			// separate buffered stream into lines with responses
			this.socket.on('data', (chunk) => {
				var i = 0,
					line = '',
					offset = 0
				this.lastData = Date.now()
				this.reconnectDelay = RECONNECT_MIN
				if (this.silent) {
					this.silent = false
					this.log('info', 'The device is responding again')
					this.updateStatus(InstanceStatus.Ok)
				}
				const text = chunk.toString()
				// Diagnostics: show everything the device says except routine status replies,
				// and show everything for 30 seconds after a command is sent. Secrets are hidden.
				if (Date.now() < this.traceUntil || !text.startsWith('STREAM STATE:')) {
					this.log('debug', 'received: ' + this.redact(text))
				}
				this.receiveBuffer += text

				while ((i = this.receiveBuffer.indexOf('\n', offset)) !== -1) {
					line = this.receiveBuffer.substr(offset, i - offset)
					offset = i + 1
					if (line.trim() == 'NACK' || line.trim() == 'NAK') {
						this.log('warn', 'The device rejected the last command (NACK). Check the settings you sent.')
					} else if (line.trim() != 'ACK') {
						this.socket.emit('receiveline', line.toString())
					}
				}

				this.receiveBuffer = this.receiveBuffer.substr(offset)
			})

			this.socket.on('receiveline', (line) => {
				if (this.command === null && line.match(/:/)) {
					this.command = line
				} else if (this.command !== null && line.length > 0) {
					this.stash.push(line.trim())
				} else if (line.length === 0 && this.command !== null) {
					var cmd = this.command.trim().split(/:/)[0]
					var obj = {}
					this.stash.forEach(function (val) {
						var info = val.split(/\s*:\s*/)
						obj[info.shift()] = info.join(':')
					})

					try {
						this.processDeviceInformation(cmd, obj)
					} catch (e) {
						this.log('warn', 'Could not process device reply "' + cmd + '": ' + e.message)
					}

					this.stash = []
					this.command = null
				} else if (line.length > 0) {
					this.log('debug', 'unexpected response from device: ' + line.toString())
				}
			})
		}
	}

	redact(text) {
		return String(text)
			.replace(/(Stream Key|Password)\s*:[^\n]*/gi, '$1: ****')
			.trim()
			.replace(/\r?\n/g, ' | ')
			.substring(0, 600)
	}

	safeSend(cmd) {
		// socket.send() is asynchronous; make sure a failed write can never crash the module
		try {
			Promise.resolve(this.socket.send(cmd)).catch((e) => {
				this.log('warn', 'Failed to send to device: ' + e.message)
			})
		} catch (e) {
			this.log('warn', 'Failed to send to device: ' + e.message)
		}
	}

	reconnect(reason) {
		this.lastReconnect = Date.now()
		this.log('warn', 'Reconnecting to device: ' + reason)
		this.initTCP()
	}

	stopPolling() {
		this.poll = false
		if (this.timer) {
			clearInterval(this.timer)
			this.timer = undefined
		}
	}

	resetParser() {
		this.receiveBuffer = ''
		this.stash = []
		this.command = null
	}

	processDeviceInformation(key, data) {
		this.log('debug', 'device information received: ' + key)

		if (key == 'IDENTITY') {
			if (data['Label'] !== undefined) {
				this.setVariableValues({ label: data['Label'] })
			}

			if (data['Model'] !== undefined) {
				this.setVariableValues({ model: data['Model'] })
			}
		}

		if (key == 'VERSION') {
			if (data['Software Release'] !== undefined) {
				this.setVariableValues({ software: data['Software Release'] })
			}
		}

		if (key == 'STREAM SETTINGS') {
			if (data['Available Video Modes'] !== undefined) {
				var m = data['Available Video Modes'].split(',')
				this.formats = []
				for (var i = 0; i < m.length; i++) {
					this.formats.push({ id: m[i].trim(), label: m[i].trim() })
				}

				this.updateActions()
			}

			if (data['Available Quality Levels'] !== undefined) {
				var q = data['Available Quality Levels'].split(',')
				this.quality = []
				for (var i = 0; i < q.length; i++) {
					this.quality.push({ id: q[i].trim(), label: q[i].trim() })
				}

				this.updateActions()
			}

			if (data['Available Default Platforms'] !== undefined) {
				var p = data['Available Default Platforms'].split(',')
				this.platforms = []
				this.customPlatforms = []

				for (var i = 0; i < p.length; i++) {
					if (p[i].trim() == 'Custom URL H.264' || p[i].trim() == 'Custom URL H.265') {
						this.customPlatforms.push({ id: p[i].trim(), label: p[i].trim() })
					} else {
						this.platforms.push({ id: p[i].trim(), label: p[i].trim() })
					}
				}

				this.updateActions()
			}

			// also list custom platforms in select list
			if (data['Available Custom Platforms'] !== undefined) {
				var p = data['Available Custom Platforms'].split(',')
				if (!this.platforms) {
					this.platforms = []
				}
				// add custom platforms to the list of default platforms
				for (var i = 0; i < p.length; i++) {
					this.platforms.push({ id: p[i].trim(), label: p[i].trim() })
				}

				this.updateActions()
			}

			if (data['Video Mode'] !== undefined) {
				this.setVariableValues({ video_mode: data['Video Mode'] })
			}

			if (data['Current Quality Level'] !== undefined) {
				this.setVariableValues({ quality: data['Current Quality Level'] })
			}

			if (data['Current Server'] !== undefined) {
				this.setVariableValues({ server: data['Current Server'] })
			}

			if (data['Current Platform'] !== undefined) {
				this.setVariableValues({ platform: data['Current Platform'] })
			}

			if (data['Stream Key'] !== undefined) {
				this.setVariableValues({ key: data['Stream Key'] })
			}

			if (data['Password'] !== undefined) {
				this.setVariableValues({ passphrase: data['Password'] })
			}

			if (data['Current URL'] !== undefined) {
				this.setVariableValues({ URL: data['Current URL'] })
			}
		}

		if (key == 'STREAM STATE') {
			// The device sends partial updates (for example only "Status: Connecting"), so only
			// change the values that are actually present in this block.
			const values = {}

			if (data['Status'] !== undefined) {
				this.streaming = data['Status']
				values.stream_state = this.streaming
			}

			if (data['Duration'] !== undefined) {
				this.duration = data['Duration']
				values.stream_duration = this.duration
				values.stream_duration_HH = this.duration.substring(3, 5)
				values.stream_duration_MM = this.duration.substring(6, 8)
				values.stream_duration_SS = this.duration.substring(9, 11)
			}

			if (data['Bitrate'] !== undefined) {
				this.bitrate = data['Bitrate']
				values.stream_bitrate = this.bitrate
			}

			if (data['Cache Used'] !== undefined) {
				this.cache = data['Cache Used']
				values.cache = this.cache
			}

			if (Object.keys(values).length > 0) {
				this.setVariableValues(values)
			}

			if (data['Status'] !== undefined) {
				this.checkFeedbacks('streaming_state')
			}
		}
	}

	async configUpdated(config) {
		let resetConnection = false

		if (this.config.host != config.host || this.config.port != config.port) {
			resetConnection = true
		}

		this.config = config

		this.updateActions()
		this.updateVariables()
		this.updateFeedbacks()
		this.updatePresets()

		if (resetConnection === true || this.socket === undefined) {
			this.initTCP()
		}
	}

	sendCommand(cmd) {
		if (cmd !== undefined) {
			this.log('debug', 'sending: ' + this.redact(cmd))
			this.traceUntil = Date.now() + 30000
			if (this.socket !== undefined && this.socket.isConnected) {
				this.safeSend(cmd)
			} else {
				this.log('warn', 'Command not sent: not connected to the device')
			}
		}
	}

	dataPoller() {
		if (this.socket !== undefined && this.socket.isConnected && this.poll) {
			// Watchdog: the device normally answers every second. If it goes quiet, the connection
			// is stuck, so drop it and start a fresh one (at most once every 15 seconds).
			const quietFor = Date.now() - this.lastData
			if (quietFor > 8000 && Date.now() - this.lastReconnect > this.reconnectDelay) {
				if (!this.silent) {
					this.silent = true
					this.log('warn', 'Connected, but the device is not responding. It may need a power cycle.')
				}
				this.updateStatus(InstanceStatus.ConnectionFailure, SILENT_MESSAGE)
				// back off (15s, 30s, 60s, then every 60s) so a stuck device isn't hammered with new connections
				this.reconnectDelay = Math.min(this.reconnectDelay * 2, RECONNECT_MAX)
				this.reconnect('no reply from the device for ' + Math.round(quietFor / 1000) + ' seconds')
				return
			}
			// The device pushes Status changes by itself; only Duration, Bitrate and Cache Used need
			// polling. So poll every second while a stream is active, but only every 5 seconds when idle
			// (this also acts as the heartbeat for the watchdog above).
			const active = this.streaming && this.streaming !== 'Idle'
			if (active || Date.now() - this.lastPoll >= IDLE_POLL) {
				this.lastPoll = Date.now()
				this.safeSend('STREAM STATE:\n\n')
			}
		}
	}
}

runEntrypoint(WebPresenter)
