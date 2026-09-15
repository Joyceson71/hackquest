'use client';

import { useEffect, useRef, useState } from 'react';
import { motion } from 'framer-motion';

export default function InteractiveBackground() {
  const [mousePosition, setMousePosition] = useState({ x: 0, y: 0 });

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      setMousePosition({ x: e.clientX, y: e.clientY });
    };
    
    window.addEventListener('mousemove', handleMouseMove);
    return () => window.removeEventListener('mousemove', handleMouseMove);
  }, []);

  return (
    <div className="fixed inset-0 z-[-1] overflow-hidden pointer-events-none bg-[#02040A]">
      {/* Deep atmospheric radial glow that tracks mouse slightly */}
      <motion.div
        className="absolute w-[800px] h-[800px] rounded-full blur-[120px] opacity-30"
        style={{
          background: 'radial-gradient(circle, rgba(0,229,255,0.4) 0%, rgba(0,0,0,0) 70%)',
          left: -400,
          top: -400,
        }}
        animate={{
          x: mousePosition.x * 0.15,
          y: mousePosition.y * 0.15,
        }}
        transition={{ type: 'tween', ease: 'easeOut', duration: 1.5 }}
      />
      
      {/* Secondary accent glow */}
      <motion.div
        className="absolute w-[600px] h-[600px] rounded-full blur-[100px] opacity-20 right-0 bottom-0"
        style={{
          background: 'radial-gradient(circle, rgba(56,189,248,0.3) 0%, rgba(0,0,0,0) 70%)',
        }}
        animate={{
          x: -(mousePosition.x * 0.05),
          y: -(mousePosition.y * 0.05),
        }}
        transition={{ type: 'tween', ease: 'easeOut', duration: 2 }}
      />

      {/* Perspective Grid */}
      <div 
        className="absolute inset-0 opacity-[0.03]"
        style={{
          backgroundImage: `
            linear-gradient(to right, #ffffff 1px, transparent 1px),
            linear-gradient(to bottom, #ffffff 1px, transparent 1px)
          `,
          backgroundSize: '40px 40px',
          transform: 'perspective(1000px) rotateX(60deg) translateY(-100px) scale(2.5)',
          transformOrigin: 'top center',
        }}
      />
    </div>
  );
}
