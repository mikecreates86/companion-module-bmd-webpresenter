# Blackmagic Web Presenter / Streaming Encoder for Bitfocus Companion

Control and monitor a Blackmagic Design **Web Presenter HD / 4K** or **Streaming Encoder HD / 4K** from Bitfocus Companion: start and stop the stream, change stream settings, and show the live state on your buttons.

This module does not support the discontinued USB-only Web Presenter.

## Download (no building needed)
1. Open the [**latest release**](../../releases/latest).
2. Under **Assets**, download the file ending in `.tgz` (for example `bmd-webpresenter-2.1.7.tgz`).
3. In Companion, use the offline module import and choose that file.

## Setup
1. Add a **Blackmagic Web Presenter** connection in Companion.
2. Enter the device's **IP address**. The port is `9977` unless you changed it.
3. Once connected, the Video Mode, Platform and Quality dropdowns fill in with what your device supports. If the device isn't connected, these dropdowns are empty and the stream settings actions will refuse to send.

## Actions
| Action | What it does |
| --- | --- |
| Streaming Control | Start, Stop or Toggle the stream |
| Stream Settings | Set Video Mode, Platform, Server, Stream Key and Quality in one go |
| YouTube Simple Settings | Set up YouTube with only a Stream Key |
| Custom URL H.264/H.265 Settings | Set a custom streaming URL and key |
| Change Video Mode / Video Quality / Stream Key / SRT Passphrase | Change one setting at a time |
| Reconnect to Device | Drops and re-opens the connection to the device (handy when working remotely) |
| Device Control | Reboot or factory reset the device |

The Server and Stream Key fields accept Companion variables. Use the Blackmagic Streaming Encoder desktop app to find the valid Server names for your platform, and your streaming service for the Stream Key.

## Feedback
**Device is streaming** turns a button a colour when the device is Idle, Connecting, Streaming or Interrupted.

## Variables
Model, label, software version, video mode, platform, server, stream key, quality, URL, SRT passphrase, stream state, stream duration (also as hours, minutes and seconds), bitrate and cache used.

## Troubleshooting
- **Status is red / not connecting:** check the IP address and that the device is on the same network.
- **Status lines stop in the log / "Device is not responding":** the module notices after 8 seconds of silence and reconnects by itself, backing off to once a minute. If it never recovers, the device itself has stopped answering and needs a power cycle. You can also press the **Reconnect to Device** action.
- **A settings button did nothing:** open the Companion log. The module reports "not connected", "no Platform selected", or that the device rejected the command.

More detail is in the [help file](companion/HELP.md). Report problems on the [issues page](../../issues). Licensed under [MIT](./LICENSE).
