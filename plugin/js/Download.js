"use strict";

class Download {
    constructor () {
    }

    static init() {
        Download.saveOn = util.isFirefox() ? Download.saveOnFirefox : Download.saveOnChrome;
        if (util.isFirefox()) {
            Download.saveOn = Download.saveOnFirefox;
            browser.downloads.onChanged.addListener(Download.onChanged);
        } else {
            Download.saveOn = Download.saveOnChrome;
            chrome.downloads.onChanged.addListener(Download.onChanged);
        }
    }

    static isFileNameIllegalOnWindows(fileName) {
        for(let c of Download.illegalWindowsFileNameChars) {
            if (fileName.includes(c)) {
                return true;
            }
        }
        return false;
    }

    /** write blob to "Downloads" directory */
    static save(blob, fileName, overwriteExisting, backgroundDownload) {
        let options = {
            url: URL.createObjectURL(blob),
            filename: fileName,
            saveAs: !backgroundDownload
        };
        if (overwriteExisting) {
            options.conflictAction = "overwrite";
        }
        let cleanup = () => { URL.revokeObjectURL(options.url); };
        return Download.saveOn(options, cleanup);
    }

    static saveOnChrome(options, cleanup) {
        // on Chrome call to download() will resolve when "Save As" dialog OPENS
        // so need to delay return until after file is actually saved
        // Otherwise, we get multiple Save As Dialogs open.
        return new Promise((resolve,reject) => {
            chrome.downloads.download(options, 
                downloadId => Download.downloadCallback(downloadId, cleanup, resolve, reject)
            );
        });
    }

    static downloadCallback(downloadId, cleanup, resolve, reject) {
        if (downloadId === undefined) {
            reject(new Error(chrome.runtime.lastError.message));
        } else {
            Download.onDownloadStarted(downloadId, 
                () => { 
                    const tenSeconds = 10 * 1000;
                    setTimeout(cleanup, tenSeconds);
                    resolve();
                }
            );
        }
    }

    static saveOnFirefox(options, cleanup) {
        return browser.runtime.getPlatformInfo().then(platformInfo => {
            // If the extension's web page is opened with the
            // "Reqeust Desktop Site" toggle enabled then only the second check
            // will correctly detect android.
            //
            // This is important to support since fetch requests can be
            // redirected to mobile versions of web sites when the toggle is
            // disabled.
            if (Download.isAndroid() || platformInfo.os.toLowerCase().includes("android")) {
                try {
                    options.saveAs = false;

                    // `browser.downloads.download` isn't implemented in
                    // "Firefox for Android" yet, so we starts downloads
                    // the same way any normal web page would do it:
                    const link = document.createElement("a");
                    link.style.display = "hidden";

                    link.href = options.url;
                    link.download = options.filename;

                    document.body.appendChild(link);
                    try {
                        link.click();
                    } finally {
                        document.body.removeChild(link);
                    }
                } finally {
                    cleanup();
                }
            } else {
                return browser.downloads.download(options).then(
                    // on Firefox, resolves when "Save As" dialog CLOSES, so no
                    // need to delay past this point.
                    downloadId => Download.onDownloadStarted(downloadId, cleanup)
                );
            }
        }).catch(cleanup);
    }

    static isAndroid() {
        let agent = navigator.userAgent.toLowerCase();
        return agent.includes("android") || 
            navigator.platform.toLowerCase().includes("android");
    }

    static onChanged(delta) {
        if ((delta.state != null) && (delta.state.current === "complete")) {
            let action = Download.toCleanup.get(delta.id);
            if (action != null) {
                Download.toCleanup.delete(delta.id);
                action();
            }
        }
    }

    static onDownloadStarted(downloadId, action) {
        if (downloadId === undefined) {
            action();
        } else {
            Download.toCleanup.set(downloadId, action);
        }
    }
}

Download.toCleanup = new Map();
Download.illegalWindowsFileNameChars = "~/?<>\\:*|\"";
Download.init();