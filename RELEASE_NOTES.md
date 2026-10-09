Clearer behaviour when the Web Presenter stops answering:

- If the device accepts the connection but never replies, the module now logs "the device is not responding, it may need a power cycle" and shows a red status instead of a misleading green one.
- Reconnect attempts back off (15 seconds, then 30, then once a minute) instead of retrying every 15 seconds.
- The module logs when the device starts responding again.
