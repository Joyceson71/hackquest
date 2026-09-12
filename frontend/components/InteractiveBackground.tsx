'use client';

import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';

export default function InteractiveBackground() {
  const [mousePosition, setMousePosition] = useState({ x: 0, y: 0 });
  const [isHovering, setIsHovering] = useState(false);

  useEffect(() => {
    const updateMousePosition = (e: MouseEvent) => {
      setMousePosition({ x: e.clientX, y: e.clientY });
      
      // Optional: Increase glow intensity if hovering over clickable elements
      const target = e.target as HTMLElement;
      if (target.closest('button, a, .card-hover, [role="button"]')) {
        setIsHovering(true);
      } else {
        setIsHovering(false);
      }
    };

    window.addEventListener('mousemove', updateMousePosition);
    return () => {
      window.removeEventListener('mousemove', updateMousePosition);
    };
  }, []);

  return (
    <div className="fixed inset-0 z-[-1] overflow-hidden pointer-events-none">
      {/* Primary Glow (Purple) */}
      <motion.div
        className="absolute w-[600px] h-[600px] rounded-full mix-blend-screen filter blur-[100px] opacity-40"
        style={{
          background: 'radial-gradient(circle, rgba(176,38,255,0.6) 0%, rgba(0,0,0,0) 70%)',
        }}
        animate={{
          x: mousePosition.x - 300,
          y: mousePosition.y - 300,
          scale: isHovering ? 1.2 : 1,
        }}
        transition={{
          type: 'spring',
          stiffness: 50,
          damping: 20,
          mass: 0.5,
        }}
      />
      
      {/* Secondary Glow (Neon Green) */}
      <motion.div
        className="absolute w-[400px] h-[400px] rounded-full mix-blend-screen filter blur-[80px] opacity-30"
        style={{
          background: 'radial-gradient(circle, rgba(57,255,20,0.5) 0%, rgba(0,0,0,0) 70%)',
        }}
        animate={{
          x: mousePosition.x - 200,
          y: mousePosition.y - 200,
        }}
        transition={{
          type: 'spring',
          stiffness: 100,
          damping: 30,
          mass: 1,
        }}
      />
    </div>
  );
}
