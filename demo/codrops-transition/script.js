(() => {
  const pages = Array.from(document.querySelectorAll(".pt-page"));
  let currentIndex = pages.findIndex((p) => p.classList.contains("pt-page-current"));
  let animating = false;

  function goTo(targetIndex, direction) {
    if (animating || targetIndex === currentIndex || targetIndex < 0 || targetIndex >= pages.length) {
      return;
    }

    animating = true;

    const outgoing = pages[currentIndex];
    const incoming = pages[targetIndex];

    // Forward: outgoing exits left, incoming enters from right.
    // Backward: outgoing exits right, incoming enters from left.
    const outClass = direction === "back" ? "pt-page-moveToRight" : "pt-page-moveToLeft";
    const inClass = direction === "back" ? "pt-page-moveFromLeft" : "pt-page-moveFromRight";

    const onOutgoingEnd = (event) => {
      if (event.target !== outgoing) return;
      outgoing.removeEventListener("animationend", onOutgoingEnd);
      outgoing.classList.remove("pt-page-current", outClass);
      incoming.classList.remove(inClass);
      currentIndex = targetIndex;
      animating = false;
    };

    outgoing.addEventListener("animationend", onOutgoingEnd);

    outgoing.classList.add(outClass);
    incoming.classList.add("pt-page-current", inClass);
  }

  document.querySelectorAll("[data-next]").forEach((btn) => {
    btn.addEventListener("click", () => goTo(currentIndex + 1, "forward"));
  });

  document.querySelectorAll("[data-back]").forEach((btn) => {
    btn.addEventListener("click", () => goTo(currentIndex - 1, "back"));
  });

  document.querySelectorAll("[data-submit]").forEach((btn) => {
    btn.addEventListener("click", () => {
      alert("Demo submit — no backend wired up.");
    });
  });
})();
