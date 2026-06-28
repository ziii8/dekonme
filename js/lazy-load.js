/* ============================================= */
/* Lazy Load Images — DEKONme v2.2            */
/* Intersection Observer + MutationObserver    */
/* Optimisé pour Supabase Image Transformation */
/* ============================================= */

class LazyLoadManager {
  constructor() {
    this.imageSelector = 'img[data-src]';
    this.loadedClass = 'lazy-loaded';
    this.errorClass = 'lazy-error';
    this.observer = null;
    this.init();
  }

  init() {
    // Fallback si l'IntersectionObserver n'est pas supporté par le navigateur mobile
    if (!('IntersectionObserver' in window)) {
      this.loadAllImages();
      return;
    }

    // Déclenche le chargement 150px avant l'apparition à l'écran
    const observerOptions = {
      root: null,
      rootMargin: '150px',
      threshold: 0,
    };

    this.observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          this.loadImage(entry.target);
          this.observer.unobserve(entry.target);
        }
      });
    }, observerOptions);

    // Observer les images déjà présentes au chargement initial
    this.observeExistingImages();

    // Surveiller automatiquement le DOM pour les futures cartes injectées (Supabase)
    this.observeDynamicImages();
  }

  observeExistingImages() {
    document.querySelectorAll(this.imageSelector).forEach((img) => {
      if (this.observer) this.observer.observe(img);
    });
  }

  loadImage(img) {
    let src = img.dataset.src;
    if (!src) return;

    // Appliquer le format optimal (ex: WebP) si supporté
    src = window.getOptimalImageUrl(src);

    // Précharge de l'image en arrière-plan pour éviter les flashs blancs
    const tempImg = new Image();
    
    tempImg.onload = () => {
      img.src = src;
      
      // Si un srcset responsive est défini
      if (img.dataset.srcset) {
        img.srcset = img.dataset.srcset;
      }
      
      // Transition fluide (Fade-in + suppression du flou)
      requestAnimationFrame(() => {
        img.classList.add(this.loadedClass);
      });

      img.dispatchEvent(new CustomEvent('lazy-loaded', { bubbles: true }));
    };

    tempImg.onerror = () => {
      console.warn(`[LazyLoad] Échec de chargement de l'image : ${src}`);
      img.classList.add(this.errorClass);
    };

    tempImg.src = src;
  }

  loadAllImages() {
    document.querySelectorAll(this.imageSelector).forEach((img) => this.loadImage(img));
  }

  // Surveillance automatique des injections asynchrones (plus besoin d'appeler manuellement initLazyLoad !)
  observeDynamicImages() {
    const observer = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        if (!mutation.addedNodes.length) return;
        
        mutation.addedNodes.forEach((node) => {
          if (node.nodeType !== 1) return; // Uniquement les nœuds Éléments HTML

          // Si le nœud contient des images avec data-src
          const images = node.querySelectorAll ? node.querySelectorAll(this.imageSelector) : [];
          images.forEach((img) => {
            if (this.observer) this.observer.observe(img);
          });

          // Si le nœud injecté est lui-même directement l'image concernée
          if (node.matches && node.matches(this.imageSelector)) {
            if (this.observer) this.observer.observe(node);
          }
        });
      });
    });

    observer.observe(document.body, {
      childList: true,
      subtree: true
    });
  }
}

// Initialisation au bon moment du cycle de vie du document
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    window.lazyLoadManager = new LazyLoadManager();
  });
} else {
  window.lazyLoadManager = new LazyLoadManager();
}

/* ==================== CSS POUR LAZY LOAD ==================== */
const lazyLoadStyles = `
  img[data-src] {
    opacity: 0;
    filter: blur(8px);
    background: var(--bg-soft);
    transition: opacity 0.4s cubic-bezier(0.25, 0.46, 0.45, 0.94), filter 0.4s ease;
    will-change: opacity, filter;
  }

  img[data-src].lazy-loaded {
    opacity: 1;
    filter: blur(0);
  }

  img[data-src].lazy-error {
    opacity: 0.4;
    filter: blur(0);
    content: url('data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="%236B6660" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"%3E%3Crect x="3" y="3" width="18" height="18" rx="2" ry="2"/%3E%3Ccircle cx="8.5" cy="8.5" r="1.5"/%3E%3Cpolyline points="21 15 16 10 5 21"/%3E%3C/svg%3E');
    object-fit: scale-down;
    padding: 20px;
  }
`;

// Injection unique dans le head
if (!document.querySelector('style[data-lazy-load]')) {
  const style = document.createElement('style');
  style.setAttribute('data-lazy-load', 'true');
  style.textContent = lazyLoadStyles;
  document.head.appendChild(style);
}

/* ==================== SUPABASE IMAGE TRANSFORMATION HELPERS ==================== */

/**
 * Génère des variantes adaptées à la taille d'écran à l'aide de l'optimisation native de Supabase Storage
 */
window.generateSrcSet = function(url, sizes = [300, 600, 900]) {
  if (!url || !url.includes('supabase.co/storage/v1/object/public/')) return '';
  
  return sizes
    .map((size) => {
      return `${url}?width=${size}&resize=contain ${size}w`;
    })
    .join(', ');
};

/**
 * Demande au CDN de Supabase de servir du WebP automatiquement à la volée
 */
window.getOptimalImageUrl = function(url) {
  if (!url || !url.includes('supabase.co/storage/v1/object/public/')) return url;
  
  // Utilisation des transformations d'images de Supabase (incluses dans l'offre gratuite)
  const separator = url.includes('?') ? '&' : '?';
  return `${url}${separator}format=webp`;
};