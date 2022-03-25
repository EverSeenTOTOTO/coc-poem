# headless-browser

Use a headless browser to fetch data. The data will always be displayed next time. `shouldUpdate` can be used to decide whether to update cache, in this example, cache will be updated every 10 minutes. By now I just use `child_process.exec('kill -9 pid')` to kill the browser process because `process.kill` in coc.nvim extension context is not allowed, this may cause memory leak, use with caution.
