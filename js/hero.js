/* =====================================================================
   HERO & COMMAND PALETTE (⌘K / Ctrl+K) SCRIPT
   ===================================================================== */
(() => {
  const cmdBtn = document.getElementById("cmd-btn");
  const modal = document.getElementById("cmd-modal");
  const input = document.getElementById("cmd-input");
  const list = document.getElementById("cmd-list");
  const closeBtn = document.getElementById("cmd-close");

  if (!cmdBtn || !modal) return;

  function openModal() {
    modal.classList.add("open");
    if (input) {
      input.value = "";
      filterItems("");
      setTimeout(() => input.focus(), 50);
    }
  }

  function closeModal() {
    modal.classList.remove("open");
  }

  cmdBtn.addEventListener("click", openModal);
  if (closeBtn) closeBtn.addEventListener("click", closeModal);

  modal.addEventListener("click", (e) => {
    if (e.target === modal) closeModal();
  });

  window.addEventListener("keydown", (e) => {
    if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
      e.preventDefault();
      if (modal.classList.contains("open")) {
        closeModal();
      } else {
        openModal();
      }
    } else if (e.key === "Escape" && modal.classList.contains("open")) {
      closeModal();
    }
  });

  function filterItems(query) {
    if (!list) return;
    const items = list.querySelectorAll(".cmd-item");
    const q = query.toLowerCase().trim();
    items.forEach((item) => {
      const text = item.textContent.toLowerCase();
      if (!q || text.includes(q)) {
        item.style.display = "flex";
      } else {
        item.style.display = "none";
      }
    });
  }

  if (input) {
    input.addEventListener("input", (e) => {
      filterItems(e.target.value);
    });
  }

  // Handle command item click actions
  if (list) {
    list.addEventListener("click", (e) => {
      const item = e.target.closest(".cmd-item");
      if (!item) return;
      const action = item.getAttribute("data-action");

      if (action === "projects") {
        closeModal();
        const el = document.querySelector(".next") || document.getElementById("bold");
        if (el) el.scrollIntoView({ behavior: "smooth" });
      } else if (action === "contact") {
        closeModal();
        window.location.href = "mailto:contact@ankurkewat.com";
      } else if (action === "copy-email") {
        navigator.clipboard.writeText("contact@ankurkewat.com").then(() => {
          const original = item.querySelector(".cmd-item-title").textContent;
          item.querySelector(".cmd-item-title").textContent = "Copied to clipboard!";
          setTimeout(() => {
            item.querySelector(".cmd-item-title").textContent = original;
            closeModal();
          }, 1000);
        });
      } else if (action === "bold") {
        closeModal();
        const bold = document.getElementById("bold");
        if (bold) bold.scrollIntoView({ behavior: "smooth" });
      } else if (action === "tech-stack") {
        closeModal();
        const tech = document.querySelector(".tech-stack-section");
        if (tech) tech.scrollIntoView({ behavior: "smooth" });
      }
    });
  }
})();
