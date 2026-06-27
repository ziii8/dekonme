/* ============================================= */
/*   Lazy Load Images — DEKONme v2.1          */
/*   Intersection Observer + responsive img   */
/* ============================================= */

/**
 * COMMENT ÇA MARCHE:
 * 1. Images ont data-src au lieu de src
 * 2. IntersectionObserver détecte quand elles entrent en view
 * 3. On charge l'image, fade-in smooth
 * 4. Support des formats modernes (webp)
 */

class LazyLoadManager {
  constructor() {
    this.imageSelector = 'img[data-src]';
    this.placeholderClass = 'lazy-loading';
    this.loadedClass = 'lazy-loaded';
    this.observer = null;
    this.init();
  }

  init() {
    // Vérifie support IntersectionObserver
    if (!('IntersectionObserver' in window)) {
      this.loadAllImages();
      return;
    }

    // Options: charge images 200px avant d'être visible
    const observerOptions = {
      root: null,
      rootMargin: '200px',
      threshold: 0,
    };

    this.observer = new IntersectionObserver(
      (entries) => this.handleIntersection(entries),
      observerOptions
    );

    // Observe toutes les images lazy
    document.querySelectorAll(this.imageSelector)
      .forEach((img) => {
        this.observer.observe(img);
      });

    // Observe aussi les images qui seraient ajoutées dynamiquement
    this.observeDynamicImages();
  }

  handleIntersection(entries) {
    entries.forEach((entry) => {
      if (entry.isIntersecting) {
        this.loadImage(entry.target);
        this.observer.unobserve(entry.target);
      }
    });
  }

  loadImage(img) {
    const src = img.dataset.src;
    const srcSet = img.dataset.srcset;

    if (!src) return;

    // Précharge l'image
    const tempImg = new Image();

    tempImg.onload = () => {
      img.classList.add(this.placeholderClass);
      img.src = src;
      if (srcSet) img.srcset = srcSet;
      
      // Fade in
      requestAnimationFrame(() => {
        img.classList.remove(this.placeholderClass);
        img.classList.add(this.loadedClass);
      });

      // Dispatch event pour tracking
      img.dispatchEvent(new CustomEvent('lazy-loaded'));
    };

    tempImg.onerror = () => {
      console.warn(`[LazyLoad] Failed to load: ${src}`);
      img.classList.add('lazy-error');
    };

    tempImg.src = src;
  }

  loadAllImages() {
    document.querySelectorAll(this.imageSelector)
      .forEach((img) => this.loadImage(img));
  }

  // Observer les images ajoutées dynamiquement au DOM
  observeDynamicImages() {
    const config = {
      childList: true,
      subtree: true,
      attributes: false,
    };

    const callback = (mutations) => {
      mutations.forEach((mutation) => {
        if (mutation.addedNodes.length) {
          mutation.addedNodes.forEach((node) => {
            if (node.nodeType === 1) { // Element node
              const images = node.querySelectorAll ? 
                node.querySelectorAll(this.imageSelector) : [];
              
              images.forEach((img) => {
                if (this.observer) this.observer.observe(img);
              });

              // Si c'est directement une image lazy
              if (node.matches && node.matches(this.imageSelector)) {
                if (this.observer) this.observer.observe(node);
              }
            }
          });
        }
      });
    };

    const observer = new MutationObserver(callback);
    observer.observe(document.body, config);
  }
}

// Init au chargement du DOM
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    window.lazyLoadManager = new LazyLoadManager();
  });
} else {
  window.lazyLoadManager = new LazyLoadManager();
}

/* ==================== CSS POUR LAZY LOAD ==================== */
// À ajouter dans style-animated.css:
const lazyLoadStyles = `
  img[data-src] {
    opacity: 1;
    transition: opacity 0.3s ease;
  }

  img[data-src].lazy-loading {
    opacity: 0;
  }

  img[data-src].lazy-loaded {
    opacity: 1;
  }

  img[data-src].lazy-error {
    opacity: 0.5;
  }

  /* Placeholder blur pendant le chargement */
  img[data-src]:not(.lazy-loaded) {
    filter: blur(5px);
    background: var(--bg-soft);
  }
`;

// Injecter le style si pas déjà là
if (!document.querySelector('style[data-lazy-load]')) {
  const style = document.createElement('style');
  style.setAttribute('data-lazy-load', 'true');
  style.textContent = lazyLoadStyles;
  document.head.appendChild(style);
}

/* ==================== HELPER: GÉNÉRER SRCSET RESPONSIVE ==================== */
/**
 * Crée un srcset responsive pour images Supabase
 * Ex: generateSrcSet('photo.jpg') → 'photo.jpg?w=400 400w, photo.jpg?w=800 800w'
 */
window.generateSrcSet = function(url, sizes = [400, 800, 1200]) {
  if (!url) return '';
  
  return sizes
    .map((size) => {
      const separator = url.includes('?') ? '&' : '?';
      return `${url}${separator}w=${size} ${size}w`;
    })
    .join(', ');
};

/* ==================== HELPER: CONVERT TO WEBP ==================== */
/**
 * Détermine le format optimal (webp si supporté, sinon jpg)
 * Ex: getOptimalImageUrl('photo.jpg') → 'photo.webp' ou 'photo.jpg'
 */
window.getOptimalImageUrl = function(url) {
  if (!url) return '';
  
  const supportsWebP = (() => {
    const canvas = document.createElement('canvas');
    return canvas.toDataURL('image/webp').indexOf('image/webp') === 5;
  })();

  if (supportsWebP && !url.includes('.webp')) {
    return url.replace(/\.(jpg|jpeg|png)$/i, '.webp');
  }
  
  return url;
};

/* ==================== MONITORING ==================== */
/**
 * Log performance metrics
 */
window.logPerformanceMetrics = function() {
  if (window.performance && window.performance.timing) {
    const timing = window.performance.timing;
    const navigation = window.performance.navigation;

    const metrics = {
      'DOM Interactive': timing.domInteractive - timing.navigationStart,
      'DOM Complete': timing.domComplete - timing.navigationStart,
      'Page Load': timing.loadEventEnd - timing.navigationStart,
      'First Paint': timing.responseStart - timing.navigationStart,
    };

    console.table(metrics);
    console.log(`[Performance] Navigation Type: ${navigation.type}`);
  }
};

// Log après chargement complet
window.addEventListener('load', () => {
  setTimeout(() => {
    console.log('[LazyLoad] Page fully loaded');
    window.logPerformanceMetrics();
  }, 1000);
});

console.log('[LazyLoad] Manager initialized');