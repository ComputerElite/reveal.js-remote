import {io} from "../../socket.io/socket.io.esm.min.js";

let showRemoteUrlCallback;
let showMfsUrlCallback;

const showRemoteUrl = () => {
    showRemoteUrlCallback()
}
const showMfsUrl = () => {
    showMfsUrlCallback()
}

const init = (reveal) => {
    let socket;
    let link;
    let image;
    let div;
    let text;

    const listeners = {};

    let pluginConfig = {
        server: window.location.protocol + "//" + window.location.host,
        shareUrl: window.location.href,
        path: "/socket.io",
        multiplex: true,
        remote: true,
        extraControl: true
    };
    let config;

    function extend(a, b) {
        for (const i in b) {
            a[i] = b[i];
        }

        return a;
    }

    function init() {
        config = reveal.getConfig();
        if (typeof config.remote === "object") {
            pluginConfig = extend(pluginConfig, config.remote);
        }

        if (pluginConfig.multiplex === false && pluginConfig.remote === false) {
            return;
        }

        console.log("Remote: connecting to", pluginConfig.server + pluginConfig.path);
        socket = io.connect(pluginConfig.server, {path: pluginConfig.path});

        socket.on("connect_error", function (err) {
            console.warn("Remote: Could not connect to socket.io-remote server", err);
        });
        socket.on("reconnect_error", function (err) {
            console.warn("Remote: Could not reconnect to socket.io-remote server", err);
        });
        socket.on("connect_timeout", function () {
            console.warn("Remote: Could not connect to socket.io-remote server (timeout)");
        });
        socket.on("reconnect_failed", function (err) {
            console.warn("Remote: Could not reconnect to socket.io-remote server - this was the last try, giving up", err);
        });
        socket.on("error", function (err) {
            console.warn("Remote: Unknown error in socket.io", err);
        });

        socket.on("connect", onConnect);
        socket.on("init", msgInit);
        socket.on("client_connected", msgClientConnected);

        if (pluginConfig.multiplex && config.remoteMultiplexId !== undefined) {
            socket.on("multiplex", msgSync);

            reveal.configure({
                controls: false,
                keyboard: false,
                touch: false,
                help: false
            });
        }

        if (pluginConfig.remote) {
            socket.on("command", msgCommand);

            on("next", reveal.next);
            on("prev", reveal.prev);
            on("up", reveal.up);
            on("down", reveal.down);
            on("left", reveal.left);
            on("right", reveal.right);
            on("overview", reveal.toggleOverview);
            on("pause", reveal.togglePause);
            on("autoslide", reveal.toggleAutoSlide);
        }


        if(pluginConfig.extraControl) createButton();
        createPopup();

        console.info("Remote: Starting connection");
    }

    const onConnect = () => {
        console.info("Remote: Connected - sending welcome message");

        if (config.remoteMultiplexId === undefined) {
            const data = {
                type: "presenter",
                shareUrl: pluginConfig.shareUrl
            };

            if (window.localStorage) {
                const hashes = JSON.parse(window.localStorage.getItem("presentations") || "{}");
                const hashUrl = pluginConfig.shareUrl.replace(/#.*/, "");

                if (hashes.hasOwnProperty(hashUrl)) {
                    data.hash = hashes[hashUrl].hash;
                    data.remoteId = hashes[hashUrl].remoteId;
                    data.multiplexId = hashes[hashUrl].multiplexId;
                }
            }

            socket.emit("start", data);
        } else {
            socket.emit("start", {
                type: "follower",
                id: config.remoteMultiplexId
            });
        }
    }


    let timer;

    function startMeasureButtonLongPress() {
        timer = setTimeout(() => {
            onButtonPress(true)
        }, 500)
    }
    function stopMeasureButtonLongPress() {
        clearTimeout(timer)
    }

    function onButtonPress(longpress = false) {
        if(longpress) {
            if(document.fullscreenElement != null) {
                document.exitFullscreen();
            } else {
                Reveal.getPlugin('RevealRemote').showRemoteUrl();
            }
        } else {
            if(document.fullscreenElement == null) {
                document.documentElement.requestFullscreen();
            }
            Reveal.getPlugin('RevealRemote').showMfsUrl();
        }
    }

    function createButton() {
        const aside = document.createElement("aside");
        aside.className = "reveal controls";
        aside.style.display = "block";
        const button = document.createElement("button");
        aside.appendChild(button);
        button.className = "reveal enabled";
        button.style = "bottom: 3.2em; right: 3.2em; width: 3.6em; height: 3.6em;"
        button.onclick = () => {
            onButtonPress();
            button.style.opacity = 0.3;
        }
        button.onmousedown = () => startMeasureButtonLongPress();
        button.onmouseup = () => stopMeasureButtonLongPress();
        button.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg"  width="3.6em"  height="3.6em"  viewBox="0 0 24 24"  fill="none"  stroke="currentColor"  stroke-width="2"  stroke-linecap="round"  stroke-linejoin="round"  class="icon icon-tabler icons-tabler-outline icon-tabler-qrcode"><path stroke="none" d="M0 0h24v24H0z" fill="none"/><path d="M4 4m0 1a1 1 0 0 1 1 -1h4a1 1 0 0 1 1 1v4a1 1 0 0 1 -1 1h-4a1 1 0 0 1 -1 -1z" /><path d="M7 17l0 .01" /><path d="M14 4m0 1a1 1 0 0 1 1 -1h4a1 1 0 0 1 1 1v4a1 1 0 0 1 -1 1h-4a1 1 0 0 1 -1 -1z" /><path d="M7 7l0 .01" /><path d="M4 14m0 1a1 1 0 0 1 1 -1h4a1 1 0 0 1 1 1v4a1 1 0 0 1 -1 1h-4a1 1 0 0 1 -1 -1z" /><path d="M17 7l0 .01" /><path d="M14 14l3 0" /><path d="M20 14l0 .01" /><path d="M14 14l0 3" /><path d="M14 20l3 0" /><path d="M17 17l3 0" /><path d="M20 17l0 3" /></svg>`
        document.getElementsByClassName("reveal")[0].appendChild(aside)
    }

    function createPopup() {
        const body = document.documentElement;
        const inner = document.createElement("div");

        link = document.createElement("a");
        image = document.createElement("img");
        div = document.createElement("div");
        text = document.createElement("p")

        div.class = "remote-qr-overlay";
        div.style.display = "none";
        div.style.position = "fixed";
        div.style.left = '0';
        div.style.top = '0';
        div.style.bottom = '0';
        div.style.right = '0';
        div.style.zIndex = '1000';
        div.style.alignItems = "end";
        div.style.justifyContent = "end";
        div.style.width = "100vw"
        div.style.height = "100vh";
        div.onclick = () => div.style.display = "none";
        div.style.backgroundColor = "#00000066"

        link.target = "_blank";
        inner.style.backgroundColor = "white"
        inner.style.border = "5px solid white";
        inner.style.borderRadius = "5px";
        inner.style.margin = "100px"
        text.style.fontSize = "1em";
        text.className = "reveal"
        text.style.color = "#AAAAAA";
        text.style.marginBottom = "5px";
        inner.style.textAlign = "center";

        div.appendChild(inner);

        inner.appendChild(link);
        inner.appendChild(text)
        link.appendChild(image);
        body.appendChild(div);
    }

    const togglePopup = (imageData, url, text_content) => {
        if (link.href === url && div.style.display !== "none") {
            div.style.display = "none";
        } else {
            image.src = imageData;
            link.href = url;
            text.innerText = text_content;
            div.style.display = "flex";
        }
    }
    const getHost = () => {
        return location.href.substring(0, location.href.indexOf(location.pathname))
    }

    const msgInit = (data) => {
        if (pluginConfig.remote) {
            // post url to mfs for showing in the selection ui
            fetch(`/api/v1/reveal/remote/${location.pathname.split("/")[1]}`, {method: "POST", headers: {"Content-Type": "application/json"}, body: JSON.stringify({
                    remoteUrl: data.remoteUrl
                })})
            reveal.addKeyBinding({keyCode: 82, key: "R", description: "Show remote control url"}, () => {
                togglePopup(data.remoteImage, data.remoteUrl, "Remote");
            });
            showRemoteUrlCallback = () => {
                togglePopup(data.remoteImage, data.remoteUrl, "direct remote");
            }
            showMfsUrlCallback = () => {
                togglePopup(data.mfsImage, getHost() + "/reveal", "mfs remotes")
            }

            reveal.addEventListener("overviewshown", sendRemoteState);
            reveal.addEventListener("overviewhidden", sendRemoteState);
            reveal.addEventListener("paused", sendRemoteState);
            reveal.addEventListener("resumed", sendRemoteState);
            reveal.addEventListener("autoslidepaused", sendRemoteState);
            reveal.addEventListener("autoslideresumed", sendRemoteState);
            reveal.addEventListener("overviewshown", sendRemoteState);
            reveal.addEventListener("overviewhidden", sendRemoteState);
            reveal.addEventListener("slidechanged", sendRemoteFullState);

            sendRemoteFullState();
        }

        if (pluginConfig.multiplex) {
            reveal.addKeyBinding({keyCode: 65, key: "A", description: "Show share url"}, function () {
                togglePopup(data.multiplexImage, data.multiplexUrl, "Audience");
            });

            window.addEventListener("load", sendMultiplexState);
            reveal.addEventListener("slidechanged", sendMultiplexState);
            reveal.addEventListener("fragmentshown", sendMultiplexState);
            reveal.addEventListener("fragmenthidden", sendMultiplexState);
            reveal.addEventListener("overviewhidden", sendMultiplexState);
            reveal.addEventListener("overviewshown", sendMultiplexState);
            reveal.addEventListener("paused", sendMultiplexState);
            reveal.addEventListener("resumed", sendMultiplexState);
            reveal.addEventListener("enable-zoom", sendMultiplexState);
            reveal.addEventListener("disable-zoom", sendMultiplexState);

            sendMultiplexState();
        }

        if (window.localStorage) {
            const hashes = JSON.parse(window.localStorage.getItem("presentations") || "{}");
            const hashUrl = pluginConfig.shareUrl.replace(/#.*/, "");
            hashes[hashUrl] = {
                hash: data.hash,
                remoteId: data.remoteId,
                multiplexId: data.multiplexId
            };
            window.localStorage.setItem("presentations", JSON.stringify(hashes));
        }
    }

    function sendRemoteFullState() {
        socket.emit("notes_changed", {
            text: reveal.getSlideNotes()
        });
        sendRemoteState();
    }

    function sendRemoteState() {
        socket.emit("state_changed", {
            isFirstSlide: reveal.isFirstSlide(),
            isLastSlide: reveal.isLastSlide(),
            isOverview: reveal.isOverview(),
            isPaused: reveal.isPaused(),
            isAutoSliding: reveal.isAutoSliding(),
            progress: reveal.getProgress(),
            slideCount: reveal.getTotalSlides(),
            indices: reveal.getIndices(),
            availableRoutes: reveal.availableRoutes(),
            autoslide: (typeof config.autoSlide === "number" && config.autoSlide > 0) &&
                (typeof config.autoSlideStoppable !== "boolean" || !config.autoSlideStoppable)
        });
    }


    function sendMultiplexState() {
        const state = reveal.getState();
        const zoomPlugin = reveal.getPlugin("remote-zoom");
        const zoom = zoomPlugin ? zoomPlugin.getCurrentZoom() : null;

        socket.emit("multiplex", {state: state, zoom: zoom});
    }

    function msgClientConnected() {
        console.log("Connected client")
        div.style.display = "none";
    }

    function msgSync(data) {
        const zoomPlugin = reveal.getPlugin("remote-zoom");

        reveal.setState(data.state);

        if (zoomPlugin) {
            zoomPlugin.setCurrentZoom(data.zoom);
        }
    }

    function on(cmd, fn) {
        listeners[cmd] = fn;
    }

    function msgCommand(data) {
        const cmd = data.command;

        if (listeners.hasOwnProperty(cmd)) {
            listeners[cmd]();
        } else {
            console.log("Remote: No listener registered for", cmd, Object.keys(listeners));
        }
    }

    init();
};

export default () => ({
    id: 'RevealRemote',
    init: init,
    showRemoteUrl: showRemoteUrl,
    showMfsUrl: showMfsUrl
});
