Aimed at the Web Presenter going quiet after going live:

- The module now notices if the device stops replying for 8 seconds and reconnects by itself.
- New "Reconnect to Device" action, so you can force a reconnect from a button when working remotely.
- The debug log now shows what the device says after each command (stream keys and passwords are hidden), to help find the cause of any remaining problems.
- A failed send can no longer cause an unhandled error. Removed repeating debug messages from the feedback.
