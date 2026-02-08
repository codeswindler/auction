import { useEffect, useRef } from "react";

export function GalaxyBackground() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // Set canvas size
    const resizeCanvas = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };
    resizeCanvas();
    window.addEventListener("resize", resizeCanvas);

    // Star field
    const stars: Array<{
      x: number;
      y: number;
      z: number;
      size: number;
      speed: number;
      color: string;
    }> = [];

    // Create stars
    const numStars = 200;
    for (let i = 0; i < numStars; i++) {
      stars.push({
        x: Math.random() * canvas.width,
        y: Math.random() * canvas.height,
        z: Math.random() * 1000,
        size: Math.random() * 2 + 0.5,
        speed: Math.random() * 0.5 + 0.1,
        color: `hsl(${200 + Math.random() * 60}, 70%, ${60 + Math.random() * 40}%)`,
      });
    }

    // Nebula clouds
    const nebulas: Array<{
      x: number;
      y: number;
      radius: number;
      opacity: number;
      color: string;
      vx: number;
      vy: number;
    }> = [];

    for (let i = 0; i < 5; i++) {
      nebulas.push({
        x: Math.random() * canvas.width,
        y: Math.random() * canvas.height,
        radius: 200 + Math.random() * 300,
        opacity: 0.1 + Math.random() * 0.15,
        color: `hsl(${220 + Math.random() * 40}, 80%, ${50 + Math.random() * 20}%)`,
        vx: (Math.random() - 0.5) * 0.2,
        vy: (Math.random() - 0.5) * 0.2,
      });
    }

    let animationFrame: number;

    const animate = () => {
      ctx.fillStyle = "rgba(10, 10, 20, 0.1)";
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      // Draw nebulas
      nebulas.forEach((nebula) => {
        nebula.x += nebula.vx;
        nebula.y += nebula.vy;

        // Wrap around edges
        if (nebula.x < -nebula.radius) nebula.x = canvas.width + nebula.radius;
        if (nebula.x > canvas.width + nebula.radius) nebula.x = -nebula.radius;
        if (nebula.y < -nebula.radius) nebula.y = canvas.height + nebula.radius;
        if (nebula.y > canvas.height + nebula.radius) nebula.y = -nebula.radius;

        const gradient = ctx.createRadialGradient(
          nebula.x,
          nebula.y,
          0,
          nebula.x,
          nebula.y,
          nebula.radius
        );
        gradient.addColorStop(0, nebula.color.replace("%)", `%, ${nebula.opacity})`));
        gradient.addColorStop(1, nebula.color.replace("%)", "%, 0)"));

        ctx.fillStyle = gradient;
        ctx.beginPath();
        ctx.arc(nebula.x, nebula.y, nebula.radius, 0, Math.PI * 2);
        ctx.fill();
      });

      // Draw stars
      stars.forEach((star) => {
        star.z -= star.speed;

        if (star.z <= 0) {
          star.z = 1000;
          star.x = Math.random() * canvas.width;
          star.y = Math.random() * canvas.height;
        }

        const x = (star.x - canvas.width / 2) * (1000 / star.z) + canvas.width / 2;
        const y = (star.y - canvas.height / 2) * (1000 / star.z) + canvas.height / 2;
        const size = (star.size * 1000) / star.z;
        const opacity = 1 - star.z / 1000;

        if (x >= 0 && x <= canvas.width && y >= 0 && y <= canvas.height) {
          ctx.fillStyle = star.color.replace("%)", `%, ${opacity})`);
          ctx.beginPath();
          ctx.arc(x, y, size, 0, Math.PI * 2);
          ctx.fill();

          // Add twinkle effect
          if (Math.random() > 0.95) {
            ctx.fillStyle = "rgba(255, 255, 255, 0.8)";
            ctx.beginPath();
            ctx.arc(x, y, size * 0.5, 0, Math.PI * 2);
            ctx.fill();
          }
        }
      });

      animationFrame = requestAnimationFrame(animate);
    };

    animate();

    return () => {
      window.removeEventListener("resize", resizeCanvas);
      cancelAnimationFrame(animationFrame);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className="fixed inset-0 -z-10 w-full h-full"
      style={{ background: "radial-gradient(ellipse at center, #1a1a2e 0%, #0a0a1a 100%)" }}
    />
  );
}

