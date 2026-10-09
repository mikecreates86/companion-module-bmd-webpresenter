// Blackmagic Design Streaming Encoders

import { InstanceBase, InstanceStatus, Regex, runEntrypoint, TCPHelper } from '@companion-module/base'
import { updateActions } from './actions.js'
import { updateFeedbacks } from './feedback.js'
import { updatePresets } from './presets.js'
import { updateVariables } from './variables.js'

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
				this.updateStatus(status, message)
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
				this.log('debug', 'Connected')
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
				this.receiveBuffer += chunk.toString()

				while ((i = this.receiveBuffer.indexOf('\n', offset)) !== -1) {
					line = this.receiveBuffer.substr(offset, i - offset)
					offset = i + 1
					if (line.trim() == 'NAK') {
						this.log('warn', 'The device rejected the last command (NAK). Check the settings you sent.')
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
			if (data['Status'] !== undefined) {
				this.streaming = data['Status']
				this.duration = data['Duration'] || '00:00:00:00'
				this.bitrate = data['Bitrate'] || '' || ''
				this.cache = data['Cache Used'] || '' || ''

				this.setVariableValues({
					stream_state: this.streaming,
					stream_duration: this.duration,
					stream_duration_HH: this.duration.substring(3, 5),
					stream_duration_MM: this.duration.substring(6, 8),
					stream_duration_SS: this.duration.substring(9, 11),
					stream_bitrate: this.bitrate,
					cache: this.cache,
				})

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
		this.log('debug', 'sending: ' + String(cmd).split('\n')[0])
		if (cmd !== undefined) {
			if (this.socket !== undefined && this.socket.isConnected) {
				this.socket.send(cmd)
			} else {
				this.log('warn', 'Command not sent: not connected to the device')
			}
		}
	}

	dataPoller() {
		if (this.socket !== undefined && this.socket.isConnected && this.poll) {
			this.socket.send('STREAM STATE:\n\n')
		}
	}
}

runEntrypoint(WebPresenter)
