var CVEmbed = (function(exports) {
  "use strict";
  function encodeResumeData(resumeData) {
    const json = JSON.stringify(resumeData);
    const bytes = new TextEncoder().encode(json);
    let binary = "";
    for (const byte of bytes) {
      binary += String.fromCharCode(byte);
    }
    return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
  }
  const SDK_SCRIPT_ORIGIN = typeof document === "undefined" ? null : (() => {
    const script = document.currentScript;
    if (!(script == null ? void 0 : script.src)) return null;
    try {
      return new URL(script.src, window.location.href).origin;
    } catch (e) {
      return null;
    }
  })();
  function getDefaultBaseUrl() {
    return SDK_SCRIPT_ORIGIN != null ? SDK_SCRIPT_ORIGIN : window.location.origin;
  }
  function resolveTarget(target) {
    if (typeof target === "string") {
      return document.querySelector(target);
    }
    return target;
  }
  function randomEmbedId() {
    return `cvembed_${Math.random().toString(36).slice(2, 10)}`;
  }
  function mergeEvents(left, right) {
    return { ...left != null ? left : {}, ...right != null ? right : {} };
  }
  const activeInstances = /* @__PURE__ */ new WeakMap();
  function buildEmbedUrl(config, embedId) {
    var _a, _b, _c, _d, _e, _f, _g, _h, _i, _j, _k, _l, _m, _n, _o;
    const baseUrl = (_a = config.baseUrl) != null ? _a : getDefaultBaseUrl();
    const resumePath = encodeURIComponent((_b = config.resumeId) != null ? _b : "portable");
    const url = new URL(`/embed/${resumePath}`, baseUrl);
    if (config.resumeData) {
      const fragment = new URLSearchParams();
      fragment.set("data", encodeResumeData(config.resumeData));
      url.hash = fragment.toString();
    }
    if ((_c = config.theme) == null ? void 0 : _c.primaryColor) {
      url.searchParams.set("primaryColor", config.theme.primaryColor);
    }
    if ((_d = config.theme) == null ? void 0 : _d.density) {
      url.searchParams.set("density", config.theme.density);
    }
    if (((_e = config.options) == null ? void 0 : _e.showDownload) === false) {
      url.searchParams.set("showDownload", "0");
    }
    if (((_f = config.options) == null ? void 0 : _f.disableDownload) === true) {
      url.searchParams.set("disableDownload", "1");
    }
    if ((_g = config.options) == null ? void 0 : _g.mode) {
      url.searchParams.set("mode", config.options.mode);
    }
    if ((_h = config.options) == null ? void 0 : _h.debug) {
      url.searchParams.set("debug", "1");
    }
    if (((_i = config.options) == null ? void 0 : _i.readOnlySections) && config.options.readOnlySections.length > 0) {
      url.searchParams.set("readOnlySections", config.options.readOnlySections.join(","));
    }
    if ((_j = config.options) == null ? void 0 : _j.lockedTemplate) {
      url.searchParams.set("lockedTemplate", config.options.lockedTemplate);
    }
    if ((_k = config.options) == null ? void 0 : _k.disableImport) {
      url.searchParams.set("disableImport", "1");
    }
    url.searchParams.set("eventOrigin", (_m = (_l = config.options) == null ? void 0 : _l.eventTargetOrigin) != null ? _m : window.location.origin);
    if (typeof ((_n = config.theme) == null ? void 0 : _n.fontScale) === "number") {
      url.searchParams.set("fontScale", String(config.theme.fontScale));
    }
    if (typeof ((_o = config.theme) == null ? void 0 : _o.radius) === "number") {
      url.searchParams.set("radius", String(config.theme.radius));
    }
    url.searchParams.set("sdkVersion", "2");
    if (embedId) {
      url.searchParams.set("embedId", embedId);
    }
    return url.toString();
  }
  function renderEmbed(config) {
    var _a, _b, _c, _d;
    if (!config.resumeId && !config.resumeData) {
      throw new Error("resumeId or resumeData is required");
    }
    const target = resolveTarget(config.target);
    if (!target) {
      throw new Error(`Target not found: ${String(config.target)}`);
    }
    (_a = activeInstances.get(target)) == null ? void 0 : _a.destroy();
    let activeConfig = { ...config };
    let listeners = mergeEvents(config.events);
    const embedId = randomEmbedId();
    const iframe = document.createElement("iframe");
    const initialUrl = buildEmbedUrl(activeConfig, embedId);
    let expectedOrigin = new URL(initialUrl).origin;
    iframe.src = initialUrl;
    iframe.width = String((_b = config.width) != null ? _b : "100%");
    iframe.height = String((_c = config.height) != null ? _c : 1100);
    iframe.frameBorder = "0";
    iframe.style.border = "0";
    iframe.setAttribute("loading", "lazy");
    iframe.setAttribute("title", (_d = config.title) != null ? _d : "Embedded CV-Embed Resume");
    iframe.referrerPolicy = "strict-origin-when-cross-origin";
    const onMessage = (event) => {
      var _a2, _b2, _c2, _d2, _e, _f, _g, _h;
      if (event.source !== iframe.contentWindow || event.origin !== expectedOrigin) {
        return;
      }
      const data = event.data;
      if (!data || data.source !== "cv-embed" || data.version !== "2" || data.embedId !== embedId || !data.payload || typeof data.payload !== "object") {
        return;
      }
      (_a2 = listeners.onMessage) == null ? void 0 : _a2.call(listeners, data);
      if (data.event === "ready") (_b2 = listeners.onReady) == null ? void 0 : _b2.call(listeners, data.payload);
      if (data.event === "validationChange") (_c2 = listeners.onValidationChange) == null ? void 0 : _c2.call(listeners, data.payload);
      if (data.event === "sectionFocus") (_d2 = listeners.onSectionFocus) == null ? void 0 : _d2.call(listeners, data.payload);
      if (data.event === "export") (_e = listeners.onExport) == null ? void 0 : _e.call(listeners, data.payload);
      if (data.event === "heightChange") {
        const nextHeight = Number(data.payload.height);
        if (((_f = activeConfig.options) == null ? void 0 : _f.autoHeight) !== false && Number.isFinite(nextHeight) && nextHeight > 0) {
          const appliedHeight = Math.min(1e4, Math.round(nextHeight));
          iframe.height = String(appliedHeight);
          (_g = listeners.onHeightChange) == null ? void 0 : _g.call(listeners, { height: appliedHeight });
          return;
        }
        (_h = listeners.onHeightChange) == null ? void 0 : _h.call(listeners, { height: Math.max(0, Math.min(1e4, Math.round(Number(iframe.height) || 0))) });
      }
    };
    window.addEventListener("message", onMessage);
    target.innerHTML = "";
    target.appendChild(iframe);
    const destroy = () => {
      window.removeEventListener("message", onMessage);
      if (activeInstances.get(target) === instance) {
        activeInstances.delete(target);
      }
      if (iframe.parentElement === target) {
        target.removeChild(iframe);
      }
    };
    const update = (nextConfig) => {
      var _a2, _b2, _c2, _d2;
      const merged = {
        ...activeConfig,
        ...nextConfig,
        theme: { ...(_a2 = activeConfig.theme) != null ? _a2 : {}, ...(_b2 = nextConfig.theme) != null ? _b2 : {} },
        options: { ...(_c2 = activeConfig.options) != null ? _c2 : {}, ...(_d2 = nextConfig.options) != null ? _d2 : {} },
        events: mergeEvents(activeConfig.events, nextConfig.events)
      };
      const nextUrl = buildEmbedUrl(merged, embedId);
      activeConfig = merged;
      expectedOrigin = new URL(nextUrl).origin;
      listeners = mergeEvents(listeners, nextConfig.events);
      if (iframe.src !== nextUrl) {
        iframe.src = nextUrl;
      }
      if (typeof nextConfig.title !== "undefined") {
        iframe.title = nextConfig.title;
      }
      if (typeof nextConfig.width !== "undefined") {
        iframe.width = String(nextConfig.width);
      }
      if (typeof nextConfig.height !== "undefined") {
        iframe.height = String(nextConfig.height);
      }
    };
    const on = (eventName, handler) => {
      listeners[eventName] = handler;
    };
    const off = (eventName, handler) => {
      if (!handler || listeners[eventName] === handler) {
        listeners[eventName] = void 0;
      }
    };
    const instance = {
      destroy,
      update,
      getIframe: () => iframe,
      on,
      off
    };
    activeInstances.set(target, instance);
    return instance;
  }
  const CVEmbed2 = {
    render: (config) => renderEmbed(config)
  };
  exports.CVEmbed = CVEmbed2;
  Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });
  return exports;
})({});
CVEmbed = CVEmbed.CVEmbed;
