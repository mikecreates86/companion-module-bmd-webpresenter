# Blackmagic Design Streaming Encoders

Module to control and monitor the [Blackmagic Design Web Presenter and Streaming Encoders](https://www.blackmagicdesign.com/products/blackmagicstreamingprocessors). This module does not support the discontinued USB only **Web Presenter** product.

Once connection to the device has been established the stream 'Video Mode', 'Platform' and 'Quality' action parameters will be populated with the options that the device supports. If no device connection is possible then these parameters will be unavailable. The 'Server' and 'Stream Key' will not be pre-populated. Use the Blackmagic Streaming Encoder desktop app to discover the valid 'Server' options for your platform. Consult your streaming platform service provider for the 'Stream Key'.

Please log issues and feature requests on [github](https://github.com/bitfocus/companion-module-bmd-webpresenter).

## Version 1.0.0
This first release of the module allows you to start/stop the stream and to receive the stream state as a variable and feedback. 

## Version 1.0.1
Added Reboot and Factory Reset actions

Added Stream Settings

## Version 1.0.2
Internal changes

## Version 1.0.3
Add support for both 4K and HD

Add more variables for monitoring

Retrieve the 'Video Mode', 'Quality' and 'Platform' options from device

## Version 1.0.4
Add support for custom streaming profiles

## Version 1.0.5
Add help text

## Version 1.0.6
Add streaming control 'Toggle' option

Added variables for stream duration, bitrate and cache level

## Version 2.0.0
Update for Companion 3

Add additional variables for stream durations (hours, minutes, seconds)

Add additional feedback states

Add additional preset

## Version 2.0.1
Add legacy module name to manifest

## Version 2.0.2
Add a warning in the log for missing Server or Stream Key

## Version 2.0.3
Allow variables to be used in Server and Stream Key fields

## Version 2.1.0
Updates for WebPresenter firmware version 3.3

- Add variables for URL, Passphrase and Software Version
- Add an action for Custom URL platforms
- Add an action for simple YouTube configuration which only needs the key
- Add separate actions for Video Mode, Stream Quality, Stream Key and SRT Passphrase

## Version 2.1.1
Fix crash when device is disconnected from network or rebooted

## Version 2.1.0
Automatically set server name for Facebook if it is left empty in the action settings

## Version 2.1.1
Fix reconnect on reboot issue

## Version 2.1.3
Update dependencies

## Version 2.1.4
Update dependencies

Add streaming encoders

## Version 2.1.5
Modernise action definitions

## Version 2.1.6
Fix the module overloading the device with status requests after the connection dropped and came back

Stream Settings and Custom URL actions now choose a platform by default and refuse to send without one

Report when the device rejects a command

## Version 2.1.7
Updated README and help text


## Version 2.1.8
Self-healing connection: if the device stops replying for 8 seconds the module reconnects by itself

Add a 'Reconnect to Device' action (usable from a button when you can't reach the device)

Diagnostic logging: the debug log now shows what the device sends back after a command (stream keys and passwords are hidden)

Failed sends can no longer cause an unhandled error

Removed repeating debug messages from the feedback

## Version 2.1.9
When the device accepts the connection but never answers, the module now says so clearly ('may need a power cycle'), shows a red status instead of a misleading green one, and retries less often (15s, 30s, then every 60s)
