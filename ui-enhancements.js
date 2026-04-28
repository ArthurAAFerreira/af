(function () {
  function getCurrentPath() {
    return (window.location.pathname || "").toLowerCase();
  }

  function getCurrentFile() {
    const path = getCurrentPath();
    const last = path.split("/").pop();
    return (last || "index.html").toLowerCase();
  }

  function isRootIndexPage() {
    const path = getCurrentPath();
    return path.endsWith("/af/") || path.endsWith("/af/index.html") || path === "/" || path === "/index.html";
  }

  function applyLayoutClasses() {
    document.body.classList.add(isRootIndexPage() ? "is-index" : "is-internal");
  }

  function normalizeInstructionItems(config) {
    if (!config) return [];

    if (Array.isArray(config.items)) {
      return config.items
        .map((item) => {
          if (!item || !item.type || !item.label) return null;
          if (item.type === "video" && item.embed) {
            return {
              type: "video",
              label: item.label,
              embed: item.embed,
              watch: item.watch || item.embed,
            };
          }

          if (item.type === "text" && item.content) {
            return {
              type: "text",
              label: item.label,
              title: item.title || item.label,
              content: item.content,
            };
          }

          if (item.type === "image" && item.src) {
            return {
              type: "image",
              label: item.label,
              title: item.title || item.label,
              src: item.src,
              alt: item.alt || item.label,
              caption: item.caption || "",
            };
          }

          if (item.type === "html" && item.content) {
            return {
              type: "html",
              label: item.label,
              title: item.title || item.label,
              content: item.content,
            };
          }

          return null;
        })
        .filter(Boolean);
    }

    if (Array.isArray(config.videos)) {
      return config.videos
        .filter((video) => video && video.label && video.embed)
        .map((video) => ({
          type: "video",
          label: video.label,
          embed: video.embed,
          watch: video.watch || video.embed,
        }));
    }

    return [];
  }

  function getIframeInstructionName(iframe, index) {
    const titleAttr = iframe.getAttribute("title");
    if (titleAttr && titleAttr.trim()) return titleAttr.trim();

    const chatItem = iframe.closest(".chat-item");
    if (chatItem) {
      const heading = chatItem.querySelector("h2, h3, h4");
      if (heading && heading.textContent) {
        const headingText = heading.textContent.replace(/\s+/g, " ").trim();
        if (headingText) return headingText;
      }
    }

    return "Iframe " + String(index + 1);
  }

  function buildDefaultInstructionItems() {
    const items = [
      {
        type: "text",
        label: "Orientações Gerais",
        title: "Orientações Gerais",
        content: "Em breve orientações sobre Orientações Gerais",
      },
    ];

    const iframes = Array.from(document.querySelectorAll("iframe"))
      .filter((iframe) => !iframe.id || iframe.id !== "enhVideoFrame");

    iframes.forEach((iframe, index) => {
      const name = getIframeInstructionName(iframe, index);
      items.push({
        type: "text",
        label: name,
        title: name,
        content: "Em breve orientações sobre " + name,
      });
    });

    return items;
  }

  function getPageInstructionConfig() {
    const config = window.pageInstructionConfig || window.pageVideoConfig;
    const extraItems = normalizeInstructionItems(config);
    const items = (config && config.replaceDefaults)
      ? extraItems
      : buildDefaultInstructionItems().concat(extraItems);

    return {
      title: (config && config.title) || "Orientações",
      items,
    };
  }

  function makeTitleClickable(header) {
    const h1 = header.querySelector("h1");
    if (!h1) return;

    let link = h1.querySelector("a");
    if (!link) {
      link = document.createElement("a");
      link.className = "header-title-link";
      link.href = "index.html";

      while (h1.firstChild) {
        link.appendChild(h1.firstChild);
      }

      h1.appendChild(link);
    } else {
      link.href = "index.html";
      link.classList.add("header-title-link");
    }

    h1.style.cursor = "pointer";
    h1.addEventListener("click", function (event) {
      if (event.target.closest("a")) return;
      window.location.href = "index.html";
    });
  }

  function appendVideoShortcut(header, hasLocalInstructions) {
    if (header.querySelector(".video-shortcut")) return;

    const actions = document.createElement("div");
    actions.className = "header-actions";
    const href = hasLocalInstructions ? "#" : "demais-sistemas.html#videos";
    actions.innerHTML = '<a class="video-shortcut" href="' + href + '" aria-expanded="false"><i class="fa-solid fa-circle-play"></i> Orientações</a>';
    header.appendChild(actions);
  }

  function updatePanelOffsets() {
    const header = document.querySelector("header");
    const footer = document.querySelector("footer");
    const headerHeight = header ? header.getBoundingClientRect().height : 0;
    const footerHeight = footer ? footer.getBoundingClientRect().height : 0;

    document.documentElement.style.setProperty("--enh-panel-top-offset", headerHeight + "px");
    document.documentElement.style.setProperty("--enh-panel-bottom-offset", footerHeight + "px");
  }

  function createInstructionPanel() {
    let overlay = document.getElementById("enhVideoOverlay");
    if (overlay) {
      return {
        overlay,
        title: overlay.querySelector("#enhVideoTitle"),
        list: overlay.querySelector("#enhVideoList"),
        content: overlay.querySelector("#enhVideoContent"),
        closeButton: overlay.querySelector("#enhVideoClose"),
      };
    }

    overlay = document.createElement("div");
    overlay.className = "enh-video-overlay";
    overlay.id = "enhVideoOverlay";
    overlay.innerHTML =
      '<aside class="enh-video-panel" role="dialog" aria-modal="true" aria-label="Orientações">' +
      '<div class="enh-video-header">' +
      '<span id="enhVideoTitle">Orientações</span>' +
      '<div class="enh-video-actions">' +
      '<button id="enhVideoClose" class="enh-video-close" type="button" aria-label="Fechar">✕</button>' +
      "</div>" +
      "</div>" +
      '<div class="enh-video-body">' +
      '<div id="enhVideoList" class="enh-video-list"></div>' +
      '<div id="enhVideoContent" class="enh-video-content"></div>' +
      "</div>" +
      "</aside>";

    document.body.appendChild(overlay);

    return {
      overlay,
      title: overlay.querySelector("#enhVideoTitle"),
      list: overlay.querySelector("#enhVideoList"),
      content: overlay.querySelector("#enhVideoContent"),
      closeButton: overlay.querySelector("#enhVideoClose"),
    };
  }

  function renderInstructionContent(refs, item) {
    refs.content.innerHTML = "";

    if (item.type === "video") {
      const frame = document.createElement("iframe");
      frame.className = "enh-video-frame";
      frame.loading = "lazy";
      frame.referrerPolicy = "strict-origin-when-cross-origin";
      frame.allowFullscreen = true;
      frame.allow = "accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share";
      frame.src = item.embed;
      refs.content.appendChild(frame);
      return;
    }

    if (item.type === "text") {
      const block = document.createElement("div");
      block.className = "enh-guide-text";

      const title = document.createElement("h3");
      title.textContent = item.title;
      block.appendChild(title);

      if (Array.isArray(item.content)) {
        item.content.forEach((paragraph) => {
          const p = document.createElement("p");
          p.textContent = paragraph;
          block.appendChild(p);
        });
      } else {
        const p = document.createElement("p");
        p.textContent = item.content;
        block.appendChild(p);
      }

      refs.content.appendChild(block);
      return;
    }

    if (item.type === "html") {
      const block = document.createElement("div");
      block.className = "enh-guide-text";

      const title = document.createElement("h3");
      title.textContent = item.title;
      block.appendChild(title);

      const body = document.createElement("div");
      body.className = "enh-guide-html";
      body.innerHTML = item.content;
      block.appendChild(body);

      refs.content.appendChild(block);
      return;
    }

    if (item.type === "image") {
      const block = document.createElement("figure");
      block.className = "enh-guide-image";

      const img = document.createElement("img");
      img.src = item.src;
      img.alt = item.alt;
      block.appendChild(img);

      if (item.caption) {
        const caption = document.createElement("figcaption");
        caption.textContent = item.caption;
        block.appendChild(caption);
      }

      refs.content.appendChild(block);
    }
  }

  function setupInstructionPanel(config) {
    const shortcut = document.querySelector(".video-shortcut");
    if (!shortcut) return;

    const refs = createInstructionPanel();
    const listButtons = [];
    let activeIndex = 0;

    refs.title.textContent = config.title;
    refs.list.innerHTML = "";

    config.items.forEach((item, index) => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "enh-video-option";
      button.textContent = item.label;
      button.dataset.index = String(index);
      refs.list.appendChild(button);
      listButtons.push(button);
    });

    function selectItem(index) {
      const safeIndex = Number.isInteger(index) ? index : 0;
      const clamped = Math.max(0, Math.min(config.items.length - 1, safeIndex));
      activeIndex = clamped;

      listButtons.forEach((button, buttonIndex) => {
        button.classList.toggle("active", buttonIndex === activeIndex);
      });

      renderInstructionContent(refs, config.items[activeIndex]);
    }

    function closePanel() {
      refs.overlay.classList.remove("open");
      refs.content.innerHTML = "";
      document.body.classList.remove("enh-panel-open");
      shortcut.setAttribute("aria-expanded", "false");
    }

    function openPanel() {
      updatePanelOffsets();
      selectItem(activeIndex);
      refs.overlay.classList.add("open");
      document.body.classList.add("enh-panel-open");
      shortcut.setAttribute("aria-expanded", "true");
    }

    shortcut.addEventListener("click", function (event) {
      event.preventDefault();

      if (refs.overlay.classList.contains("open")) {
        closePanel();
        return;
      }

      openPanel();
    });

    refs.closeButton.addEventListener("click", closePanel);

    refs.overlay.addEventListener("click", function (event) {
      if (event.target === refs.overlay) closePanel();
    });

    document.addEventListener("keydown", function (event) {
      if (event.key === "Escape" && refs.overlay.classList.contains("open")) {
        closePanel();
      }
    });

    listButtons.forEach((button) => {
      button.addEventListener("click", function () {
        const index = Number(button.dataset.index || "0");
        selectItem(index);
      });
    });
  }

  function getDynamicIframeHeight(iframe) {
    const viewportHeight = window.innerHeight || document.documentElement.clientHeight || 800;
    const pageHeader = document.querySelector("header");
    const pageFooter = document.querySelector("footer");
    const chatItem = iframe.closest(".chat-item");
    const chatHeader = chatItem ? chatItem.querySelector("h2, .chat-header") : null;

    const pageHeaderHeight = pageHeader ? pageHeader.getBoundingClientRect().height : 0;
    const pageFooterHeight = pageFooter ? pageFooter.getBoundingClientRect().height : 0;
    const chatHeaderHeight = chatHeader ? chatHeader.getBoundingClientRect().height : 0;

    const reservedSpace = 56;
    const calculatedHeight = viewportHeight - pageHeaderHeight - pageFooterHeight - chatHeaderHeight - reservedSpace;
    return Math.max(420, calculatedHeight);
  }

  function applyDynamicIframeHeight(iframe) {
    if (!iframe || iframe.classList.contains("enh-video-frame") || iframe.id === "enhVideoFrame") return;

    const explicitInlineHeight = parseInt(iframe.style.height, 10);
    const dynamicHeight = getDynamicIframeHeight(iframe);
    const finalHeight = Number.isFinite(explicitInlineHeight)
      ? Math.max(dynamicHeight, explicitInlineHeight)
      : dynamicHeight;

    iframe.style.height = finalHeight + "px";
  }

  function setupDynamicIframeHeights() {
    function isVisible(iframe) {
      if (!iframe) return false;
      const computed = window.getComputedStyle(iframe);
      return computed.display !== "none";
    }

    function refreshVisibleIframes() {
      document.querySelectorAll(".chat-item iframe").forEach((iframe) => {
        if (isVisible(iframe)) {
          applyDynamicIframeHeight(iframe);
        }
      });
    }

    document.addEventListener("click", function (event) {
      const toggleHeader = event.target.closest(".chat-item h2, .chat-header");
      if (!toggleHeader) return;

      window.setTimeout(refreshVisibleIframes, 0);
    });

    window.addEventListener("resize", refreshVisibleIframes);
    refreshVisibleIframes();
  }

  function init() {
    const currentFile = getCurrentFile();
    const hasInstructionShortcut = currentFile !== "demais-sistemas.html" && !isRootIndexPage();
    applyLayoutClasses();
    const pageInstructionConfig = getPageInstructionConfig();
    updatePanelOffsets();
    window.addEventListener("resize", updatePanelOffsets);

    const header = document.querySelector("header");
    if (header) {
      makeTitleClickable(header);
      if (hasInstructionShortcut) {
        appendVideoShortcut(header, true);
      }
    }

    if (hasInstructionShortcut && pageInstructionConfig) {
      setupInstructionPanel(pageInstructionConfig);
    }

    setupDynamicIframeHeights();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
