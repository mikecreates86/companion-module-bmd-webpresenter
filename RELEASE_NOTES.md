Fixes for needing to restart the Web Presenter when going live, and for stream settings not applying:

- Fixed the module stacking up extra status checks every time the connection dropped and came back, which could overload the device.
- Half-received replies are now thrown away on reconnect, and a bad reply can no longer stop status updates.
- Stream Settings and Custom URL actions now pick a platform by default, refuse to send with no platform, and format commands consistently.
- The module now reports when the device rejects a command, and no longer sends commands while disconnected.
- Changing the port in settings now reconnects. Stream keys are no longer written to the debug log.
