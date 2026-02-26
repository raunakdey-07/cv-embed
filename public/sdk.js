(function (global) {
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

  function buildEmbedUrl(baseUrl, resumeId, theme, options) {
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

    return url.toString()
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

      var iframe = document.createElement('iframe')
      iframe.src = buildEmbedUrl(
        baseUrl,
        config.resumeId,
        config.theme || {},
        {
          showDownload: config.options && config.options.showDownload,
          resumeData: config.resumeData,
        }
      )
      iframe.width = config.width || '100%'
      iframe.height = String(config.height || 1100)
      iframe.frameBorder = '0'
      iframe.style.border = '0'
      iframe.setAttribute('loading', 'lazy')
      iframe.setAttribute('title', config.title || 'Embedded CV-Embed Resume')
      iframe.referrerPolicy = 'strict-origin-when-cross-origin'

      target.innerHTML = ''
      target.appendChild(iframe)
    },
  }

  global.CVEmbed = CVEmbed
})(window)
