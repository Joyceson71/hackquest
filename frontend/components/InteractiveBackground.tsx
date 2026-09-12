'use client';

import { useEffect, useRef } from 'react';

export default function InteractiveBackground() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animationFrameId: number;
    let width = 0;
    let height = 0;
    let time = 0;

    const mouse = {
      x: -1000,
      y: -1000,
      targetX: -1000,
      targetY: -1000,
    };

    // Soft, premium gradients
    const colors = [
      { r: 139, g: 92, b: 246 },  // Violet 500
      { r: 59, g: 130, b: 246 },  // Blue 500
      { r: 99, g: 102, b: 241 },  // Indigo 500
    ];

    class Orb {
      x: number;
      y: number;
      radius: number;
      color: { r: number, g: number, b: number };
      vx: number;
      vy: number;
      angle: number;
      speed: number;

      constructor(x: number, y: number, radius: number, colorIndex: number) {
        this.x = x;
        this.y = y;
        this.radius = radius;
        this.color = colors[colorIndex];
        this.vx = (Math.random() - 0.5) * 0.5;
        this.vy = (Math.random() - 0.5) * 0.5;
        this.angle = Math.random() * Math.PI * 2;
        this.speed = Math.random() * 0.002 + 0.001;
      }

      draw() {
        if (!ctx) return;
        const gradient = ctx.createRadialGradient(
          this.x, this.y, 0,
          this.x, this.y, this.radius
        );
        gradient.addColorStop(0, `rgba(${this.color.r}, ${this.color.g}, ${this.color.b}, 0.15)`);
        gradient.addColorStop(0.5, `rgba(${this.color.r}, ${this.color.g}, ${this.color.b}, 0.05)`);
        gradient.addColorStop(1, `rgba(${this.color.r}, ${this.color.g}, ${this.color.b}, 0)`);

        ctx.fillStyle = gradient;
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
        ctx.fill();
      }

      update(time: number) {
        // Slow organic drift
        this.angle += this.speed;
        this.x += Math.cos(this.angle) * 0.5;
        this.y += Math.sin(this.angle) * 0.5;

        // Gentle boundary push
        if (this.x < -this.radius) this.x = width + this.radius;
        if (this.x > width + this.radius) this.x = -this.radius;
        if (this.y < -this.radius) this.y = height + this.radius;
        if (this.y > height + this.radius) this.y = -this.radius;

        // Subtle mouse interaction
        const dx = mouse.x - this.x;
        const dy = mouse.y - this.y;
        const distance = Math.sqrt(dx * dx + dy * dy);
        
        if (distance < 600) {
          const force = (600 - distance) / 600;
          this.x -= dx * force * 0.01;
          this.y -= dy * force * 0.01;
        }
      }
    }

    let orbs: Orb[] = [];

    const init = () => {
      orbs = [];
      const numOrbs = Math.min(Math.floor((width * height) / 150000), 6);
      for (let i = 0; i < numOrbs; i++) {
        const radius = Math.random() * 200 + 300; // Large, soft orbs
        const x = Math.random() * width;
        const y = Math.random() * height;
        orbs.push(new Orb(x, y, radius, i % colors.length));
      }
    };

    const animate = () => {
      // Clear with dark zinc background
      ctx.fillStyle = '#09090b';
      ctx.fillRect(0, 0, width, height);
      
      // Smooth mouse interpolation
      mouse.x += (mouse.targetX - mouse.x) * 0.05;
      mouse.y += (mouse.targetY - mouse.y) * 0.05;
      
      time += 1;

      // Draw interactive mouse glow
      if (mouse.x > -500) {
        const gradient = ctx.createRadialGradient(
          mouse.x, mouse.y, 0,
          mouse.x, mouse.y, 400
        );
        gradient.addColorStop(0, 'rgba(139, 92, 246, 0.1)');
        gradient.addColorStop(1, 'rgba(139, 92, 246, 0)');
        ctx.fillStyle = gradient;
        ctx.beginPath();
        ctx.arc(mouse.x, mouse.y, 400, 0, Math.PI * 2);
        ctx.fill();
      }

      for (let i = 0; i < orbs.length; i++) {
        orbs[i].update(time);
        orbs[i].draw();
      }
      
      // Add subtle noise overlay for texture
      const imageData = ctx.getImageData(0, 0, width, height);
      const data = imageData.data;
      for (let i = 0; i < data.length; i += 4) {
        const noise = (Math.random() - 0.5) * 8; // Adjust noise intensity here
        data[i] += noise;
        data[i+1] += noise;
        data[i+2] += noise;
      }
      // Note: In high framerates, pixel manipulation is costly. 
      // Instead, we just draw a very subtle noise pattern overlay using a base64 image or CSS.
      // But we will skip canvas noise for performance and rely on CSS if needed.

      animationFrameId = requestAnimationFrame(animate);
    };

    const handleResize = () => {
      width = window.innerWidth;
      height = window.innerHeight;
      canvas.width = width;
      canvas.height = height;
      init();
    };

    const handleMouseMove = (e: MouseEvent) => {
      mouse.targetX = e.clientX;
      mouse.targetY = e.clientY;
    };

    const handleMouseLeave = () => {
      mouse.targetX = -1000;
      mouse.targetY = -1000;
    };

    window.addEventListener('resize', handleResize);
    window.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseleave', handleMouseLeave);

    handleResize();
    animate();

    return () => {
      window.removeEventListener('resize', handleResize);
      window.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseleave', handleMouseLeave);
      cancelAnimationFrame(animationFrameId);
    };
  }, []);

  return (
    <div className="fixed inset-0 z-[-1] pointer-events-none bg-[#09090b]">
      <canvas
        ref={canvasRef}
        className="absolute inset-0 w-full h-full opacity-80 mix-blend-screen"
      />
      {/* Subtle noise overlay via CSS for premium texture */}
      <div 
        className="absolute inset-0 opacity-[0.03]"
        style={{ backgroundImage: 'url("data:image/svg+xml,%3Csvg viewBox=%220 0 200 200%22 xmlns=%22http://www.w3.org/2000/svg%22%3E%3Cfilter id=%22noiseFilter%22%3E%3CfeTurbulence type=%22fractalNoise%22 baseFrequency=%220.65%22 numOctaves=%223%22 stitchTiles=%22stitch%22/%3E%3C/filter%3E%3Crect width=%22100%25%22 height=%22100%25%22 filter=%22url(%23noiseFilter)%22/%3E%3C/svg%3E")' }}
      ></div>
    </div>
  );
}
