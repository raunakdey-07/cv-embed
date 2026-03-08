(function (global) {
  function randomEmbedId() {
    return 'cvembed_' + Math.random().toString(36).slice(2, 10)
  }

  function getDefaultBaseUrl() {
    var script = document.currentScript
    if (script && script.src) {
      try {
        var scriptUrl = new URL(script.src, window.location.href)
        return scriptUrl.origin
      } catch (_) {
      }
    }

    var scripts = document.getElementsByTagName('script')
    for (var index = scripts.length - 1; index >= 0; index -= 1) {
      var src = scripts[index].src || ''
      if (/\/sdk\.js(\?|$)/.test(src)) {
        try {
          var fallbackScriptUrl = new URL(src, window.location.href)
          return fallbackScriptUrl.origin
        } catch (_) {
        }
      }
    }

    return window.location.origin
  }

  function encodeResumeData(resumeData) {
    var json = JSON.stringify(resumeData)
    var utf8 = unescape(encodeURIComponent(json))
    var base64 = btoa(utf8)
    return base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '')
  }

  function resolveTarget(target) {
    if (typeof target === 'string') {
      return document.querySelector(target)
    }

    if (target && target.nodeType === 1) {
      return target
    }

    return null
  }

  function buildEmbedUrl(baseUrl, resumeId, theme, options, embedId) {
    var hasResumeData = !!(options && options.resumeData)
    var pathResumeId = resumeId || 'portable'
    var url = new URL('/embed/' + encodeURIComponent(pathResumeId), baseUrl)

    if (hasResumeData) {
      url.searchParams.set('data', encodeResumeData(options.resumeData))
    }

    if (theme && theme.primaryColor) {
      url.searchParams.set('primaryColor', theme.primaryColor)
    }

    if (theme && theme.density) {
      url.searchParams.set('density', theme.density)
    }

    if (options && options.showDownload === false) {
      url.searchParams.set('showDownload', '0')
    }

    if (options && options.disableDownload === true) {
      url.searchParams.set('disableDownload', '1')
    }

    if (options && options.mode) {
      url.searchParams.set('mode', options.mode)
    }

    if (options && options.debug) {
      url.searchParams.set('debug', '1')
    }

    if (options && options.disableImport) {
      url.searchParams.set('disableImport', '1')
    }

    if (options && options.readOnlySections && options.readOnlySections.length > 0) {
      url.searchParams.set('readOnlySections', options.readOnlySections.join(','))
    }

    if (options && options.lockedTemplate) {
      url.searchParams.set('lockedTemplate', options.lockedTemplate)
    }

    if (options && options.eventTargetOrigin) {
      url.searchParams.set('eventOrigin', options.eventTargetOrigin)
    }

    if (theme && typeof theme.fontScale === 'number') {
      url.searchParams.set('fontScale', String(theme.fontScale))
    }

    if (theme && typeof theme.radius === 'number') {
      url.searchParams.set('radius', String(theme.radius))
    }

    url.searchParams.set('sdkVersion', '2')
    url.searchParams.set('embedId', embedId)

    return url.toString()
  }

  function mergeEvents(current, next) {
    var out = {}
    var key
    current = current || {}
    next = next || {}
    for (key in current) out[key] = current[key]
    for (key in next) out[key] = next[key]
    return out
  }

  var CVEmbed = {
    render: function render(config) {
      if (!config || !config.target || (!config.resumeId && !config.resumeData)) {
        throw new Error('CVEmbed.render requires target and either resumeId or resumeData')
      }

      var target = resolveTarget(config.target)
      if (!target) {
        throw new Error('Target not found. Provide a valid selector or HTMLElement')
      }

      var baseUrl = config.baseUrl || getDefaultBaseUrl()
      var embedId = randomEmbedId()
      var listeners = mergeEvents(config.events)
      var activeConfig = config

      var iframe = document.createElement('iframe')
      iframe.src = buildEmbedUrl(
        baseUrl,
        config.resumeId,
        config.theme || {},
        {
          showDownload: config.options && config.options.showDownload,
          disableDownload: config.options && config.options.disableDownload,
          mode: config.options && config.options.mode,
          debug: config.options && config.options.debug,
          disableImport: config.options && config.options.disableImport,
          readOnlySections: config.options && config.options.readOnlySections,
          lockedTemplate: config.options && config.options.lockedTemplate,
          eventTargetOrigin: config.options && config.options.eventTargetOrigin,
          resumeData: config.resumeData,
        },
        embedId
      )
      iframe.width = config.width || '100%'
      iframe.height = String(config.height || 1100)
      iframe.frameBorder = '0'
      iframe.style.border = '0'
      iframe.setAttribute('loading', 'lazy')
      iframe.setAttribute('title', config.title || 'Embedded CV-Embed Resume')
      iframe.referrerPolicy = 'strict-origin-when-cross-origin'

      function onMessage(event) {
        var data = event.data || {}
        if (event.source !== iframe.contentWindow) return
        if (data.source !== 'cv-embed' || data.version !== '2' || data.embedId !== embedId) return

        if (listeners.onMessage) listeners.onMessage(data)
        if (data.event === 'ready' && listeners.onReady) listeners.onReady(data.payload)
        if (data.event === 'validationChange' && listeners.onValidationChange) listeners.onValidationChange(data.payload)
        if (data.event === 'export' && listeners.onExport) listeners.onExport(data.payload)
        if (data.event === 'sectionFocus' && listeners.onSectionFocus) listeners.onSectionFocus(data.payload)
        if (data.event === 'heightChange') {
          var height = Number(data.payload && data.payload.height)
          if ((!activeConfig.options || activeConfig.options.autoHeight !== false) && Number.isFinite(height) && height > 0) {
            iframe.height = String(Math.round(height))
          }
          if (listeners.onHeightChange) listeners.onHeightChange({ height: height })
        }
      }

      window.addEventListener('message', onMessage)

      target.innerHTML = ''
      target.appendChild(iframe)

      return {
        destroy: function () {
          window.removeEventListener('message', onMessage)
          if (iframe.parentElement === target) {
            target.removeChild(iframe)
          }
        },
        update: function (nextConfig) {
          nextConfig = nextConfig || {}
          activeConfig = {
            target: activeConfig.target,
            resumeId: (typeof nextConfig.resumeId !== 'undefined') ? nextConfig.resumeId : activeConfig.resumeId,
            resumeData: (typeof nextConfig.resumeData !== 'undefined') ? nextConfig.resumeData : activeConfig.resumeData,
            baseUrl: (typeof nextConfig.baseUrl !== 'undefined') ? nextConfig.baseUrl : activeConfig.baseUrl,
            width: (typeof nextConfig.width !== 'undefined') ? nextConfig.width : activeConfig.width,
            height: (typeof nextConfig.height !== 'undefined') ? nextConfig.height : activeConfig.height,
            title: (typeof nextConfig.title !== 'undefined') ? nextConfig.title : activeConfig.title,
            theme: Object.assign({}, activeConfig.theme || {}, nextConfig.theme || {}),
            options: Object.assign({}, activeConfig.options || {}, nextConfig.options || {}),
            events: mergeEvents(activeConfig.events, nextConfig.events),
          }

          listeners = mergeEvents(listeners, nextConfig.events)
          iframe.src = buildEmbedUrl(
            activeConfig.baseUrl || getDefaultBaseUrl(),
            activeConfig.resumeId,
            activeConfig.theme || {},
            Object.assign({}, activeConfig.options || {}, { resumeData: activeConfig.resumeData }),
            embedId
          )

          if (typeof nextConfig.width !== 'undefined') iframe.width = String(nextConfig.width)
          if (typeof nextConfig.height !== 'undefined') iframe.height = String(nextConfig.height)
        },
        getIframe: function () {
          return iframe
        },
        on: function (eventName, handler) {
          listeners[eventName] = handler
        },
        off: function (eventName, handler) {
          if (!handler || listeners[eventName] === handler) {
            delete listeners[eventName]
          }
        },
      }
    },
  }

  global.CVEmbed = CVEmbed
})(window)
