// ============================================================================
// Abstract Interactive Portfolio - Minimalist Design System
// ============================================================================

// PARTICLE SYSTEM - Abstract floating particles
class ParticleSystem {
  constructor() {
    this.particles = [];
    this.createInitialParticles();
    this.animate();
  }

  createInitialParticles() {
    // Create scattered particles across viewport
    const particleCount = Math.floor(window.innerWidth / 150);
    for (let i = 0; i < particleCount; i++) {
      this.createParticle();
    }
  }

  createParticle() {
    const particle = document.createElement('div');
    particle.style.position = 'fixed';
    particle.style.width = Math.random() * 3 + 1 + 'px';
    particle.style.height = particle.style.width;
    particle.style.borderRadius = '50%';
    particle.style.background = `rgba(162, 155, 254, ${Math.random() * 0.3 + 0.1})`;
    particle.style.pointerEvents = 'none';
    particle.style.zIndex = '0';
    particle.style.left = Math.random() * 100 + '%';
    particle.style.top = Math.random() * 100 + '%';
    
    document.body.appendChild(particle);
    
    const particle_obj = {
      element: particle,
      x: parseFloat(particle.style.left),
      y: parseFloat(particle.style.top),
      vx: (Math.random() - 0.5) * 0.5,
      vy: (Math.random() - 0.5) * 0.3,
      life: 1
    };
    
    this.particles.push(particle_obj);
  }

  animate() {
    this.particles.forEach((p, idx) => {
      p.x += p.vx;
      p.y += p.vy;
      
      // Wrap around screen
      if (p.x < 0) p.x = 100;
      if (p.x > 100) p.x = 0;
      if (p.y < 0) p.y = 100;
      if (p.y > 100) p.y = 0;
      
      p.element.style.left = p.x + '%';
      p.element.style.top = p.y + '%';
    });
    
    requestAnimationFrame(() => this.animate());
  }
}

// UNIVERSAL RIPPLE EFFECT - Ripples follow cursor
class UniversalRipple {
  constructor() {
    this.lastRippleTime = 0;
    this.rippleDelay = 150; // ms between ripples
    document.addEventListener('mousemove', (e) => this.onMouseMove(e));
  }

  onMouseMove(event) {
    const now = Date.now();
    if (now - this.lastRippleTime > this.rippleDelay) {
      this.createRipple(event.pageX, event.pageY);
      this.lastRippleTime = now;
    }
  }

  createRipple(x, y) {
    const ripple = document.createElement('div');
    ripple.style.position = 'fixed';
    ripple.style.left = x + 'px';
    ripple.style.top = y + 'px';
    ripple.style.width = '15px';
    ripple.style.height = '15px';
    ripple.style.borderRadius = '50%';
    ripple.style.border = '1px solid rgba(162, 155, 254, 0.4)';
    ripple.style.pointerEvents = 'none';
    ripple.style.zIndex = '999';
    ripple.style.animation = `ripple-spread 1s ease-out`;
    ripple.style.transform = 'translate(-50%, -50%)';
    
    document.body.appendChild(ripple);
    setTimeout(() => ripple.remove(), 1000);
  }
}

// SONAR SWEEP - Periodic sonar effect across page
class SonarSweep {
  constructor() {
    this.setupSonar();
  }

  setupSonar() {
    setInterval(() => {
      if (Math.random() > 0.7) {
        this.triggerSonar();
      }
    }, 3000);
  }

  triggerSonar() {
    const sonar = document.createElement('div');
    sonar.style.position = 'fixed';
    sonar.style.top = '50%';
    sonar.style.left = '50%';
    sonar.style.width = '100px';
    sonar.style.height = '100px';
    sonar.style.borderRadius = '50%';
    sonar.style.border = '2px solid rgba(0, 188, 212, 0.6)';
    sonar.style.pointerEvents = 'none';
    sonar.style.zIndex = '999';
    sonar.style.animation = `sonar-ping 1.2s ease-out`;
    
    document.body.appendChild(sonar);
    setTimeout(() => sonar.remove(), 1200);
  }
}

const sonarStyle = document.createElement('style');
sonarStyle.textContent = `
  @keyframes sonar-ping {
    0% {
      transform: translate(-50%, -50%) scale(0);
      opacity: 1;
    }
    100% {
      transform: translate(-50%, -50%) scale(3);
      opacity: 0;
    }
  }
`;
document.head.appendChild(sonarStyle);

// THEME TOGGLE - Light/Dark Mode
class ThemeToggle {
  constructor() {
    this.button = document.getElementById('theme-toggle');
    this.icon = document.querySelector('.theme-toggle i');
    this.loadTheme();
    this.setupToggle();
  }

  loadTheme() {
    const saved = localStorage.getItem('theme');
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    const isDark = saved ? saved === 'dark' : prefersDark;
    
    if (!isDark) {
      document.documentElement.classList.add('light-mode');
      this.icon.classList.remove('fa-sun');
      this.icon.classList.add('fa-moon');
    } else {
      this.icon.classList.remove('fa-moon');
      this.icon.classList.add('fa-sun');
    }
  }

  setupToggle() {
    this.button.addEventListener('click', () => this.toggle());
  }

  toggle() {
    const isLight = document.documentElement.classList.contains('light-mode');
    
    if (isLight) {
      document.documentElement.classList.remove('light-mode');
      localStorage.setItem('theme', 'dark');
      this.icon.classList.remove('fa-moon');
      this.icon.classList.add('fa-sun');
    } else {
      document.documentElement.classList.add('light-mode');
      localStorage.setItem('theme', 'light');
      this.icon.classList.remove('fa-sun');
      this.icon.classList.add('fa-moon');
    }
  }
}

// INITIALIZE OCEAN ON PAGE LOAD
document.addEventListener('DOMContentLoaded', () => {
  // Update copyright year automatically
  const yearElement = document.getElementById('year');
  if (yearElement) {
    yearElement.textContent = new Date().getFullYear();
  }
  
  // Initialize theme toggle
  new ThemeToggle();
});

