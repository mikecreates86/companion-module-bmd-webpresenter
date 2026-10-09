Checked against Blackmagic's official Streaming Ethernet Protocol document (v1.2):

- Fixed: the module never noticed when the device rejected a command, because the device says "NACK" and the module was listening for "NAK". It now logs a clear warning.
- Fixed: partial status updates from the device (for example just "Connecting") no longer blank the duration, bitrate and cache variables.
- Less traffic: the module now checks the device every second only while a stream is active, and every 5 seconds when idle. The device announces status changes itself, so idle polling was unnecessary.
