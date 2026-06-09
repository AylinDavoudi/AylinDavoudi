// ── Custom crosshair cursor ──
const dot = document.querySelector('.cursor-dot');
const ring = document.querySelector('.cursor-ring');

let mouseX = 0, mouseY = 0;
let ringX = 0, ringY = 0;

document.addEventListener('mousemove', e => {
    mouseX = e.clientX;
    mouseY = e.clientY;
    dot.style.left = mouseX + 'px';
    dot.style.top  = mouseY + 'px';
});

// Ring follows with slight lag
function animateRing() {
    ringX += (mouseX - ringX) * 0.12;
    ringY += (mouseY - ringY) * 0.12;
    ring.style.left = ringX + 'px';
    ring.style.top  = ringY + 'px';
    requestAnimationFrame(animateRing);
}
animateRing();

// Expand ring on hoverable elements
document.querySelectorAll('a, button, .btn, .flip-card, .services-box, .skill-item, .contact-card').forEach(el => {
    el.addEventListener('mouseenter', () => ring.classList.add('hovered'));
    el.addEventListener('mouseleave', () => ring.classList.remove('hovered'));
});


// ── CFD Flow Field ──
(function(){
    const canvas = document.getElementById('cfd-canvas');
    const ctx = canvas.getContext('2d');
    const wrap = canvas.parentElement;

    let W, H, cx, cy, R;
    let mouse = {x:-999, y:-999};
    let parts = [];
    let rk = null, rt = [];

    wrap.addEventListener('mousemove', e => {
        const r = wrap.getBoundingClientRect();
        mouse.x = e.clientX - r.left;
        mouse.y = e.clientY - r.top;
    });
    wrap.addEventListener('mouseleave', () => { mouse.x=-999; mouse.y=-999; });

    function col(t, a){
        t = Math.max(0, Math.min(1, t));
        let r, g, b;
        if(t<0.25){const s=t/0.25; r=0; g=Math.round(s*180); b=255;}
        else if(t<0.5){const s=(t-0.25)/0.25; r=0; g=255; b=Math.round(255*(1-s));}
        else if(t<0.75){const s=(t-0.5)/0.25; r=Math.round(s*255); g=255; b=0;}
        else{const s=(t-0.75)/0.25; r=255; g=Math.round(255*(1-s*0.85)); b=0;}
        return `rgba(${r},${g},${b},${a})`;
    }

    function vel(x, y){
        const dx=x-cx, dy=y-cy, r2=dx*dx+dy*dy;
        if(r2 <= R*R) return {u:0, v:0, spd:0};
        const R2=R*R, r4=r2*r2;
        let u = 1 - R2*(dx*dx-dy*dy)/r4;
        let v = -2*R2*dx*dy/r4;
        const G=1.0, wx=cx+R*1.4;
        const wy1=cy-R*0.7, wy2=cy+R*0.7;
        const d1x=x-wx, d1y=y-wy1, r1=d1x*d1x+d1y*d1y;
        const d2x=x-wx, d2y=y-wy2, r2b=d2x*d2x+d2y*d2y;
        if(r1>4){u+=G*d1y/r1; v+=-G*d1x/r1;}
        if(r2b>4){u+=-G*d2y/r2b; v+=G*d2x/r2b;}
        const mdx=x-mouse.x, mdy=y-mouse.y, mr=mdx*mdx+mdy*mdy;
        if(mr<40*40 && mr>0.5){const s=10*(1-Math.sqrt(mr)/40)/Math.sqrt(mr); u+=s*mdx; v+=s*mdy;}
        const spd = Math.sqrt(u*u+v*v);
        return {u, v, spd};
    }

    function seed(){
        if(Math.random()<0.2){
            const top = Math.random()<0.5;
            const a = Math.random()*Math.PI*2;
            const rr = R*(0.1+Math.random()*0.8);
            return {x: cx+R*1.4+Math.cos(a)*rr*0.5, y: (top?cy-R*0.7:cy+R*0.7)+Math.sin(a)*rr*0.5};
        }
        return {x: 0, y: Math.random()*H};
    }

    function reset(p){
        const s = seed();
        p.x=s.x; p.y=s.y; p.life=0;
        p.maxLife = 300+Math.random()*300;
        p.trail=[];
    }

    function setup(){
        W = canvas.width  = wrap.offsetWidth;
        H = canvas.height = wrap.offsetHeight;

        // get actual photo element position
        const img = wrap.querySelector('.home-img img') || wrap.querySelector('.home-img');
        if(img){
            const wr = wrap.getBoundingClientRect();
            const ir = img.getBoundingClientRect();
            cx = ir.left - wr.left + ir.width * 0.5;
            cy = ir.top  - wr.top  + ir.height * 0.5;
            R  = Math.min(ir.width, ir.height) * 0.5;
        } else {
            cx = W*0.72; cy = H*0.5; R = H*0.21;
        }
        parts = [];
        for(let i=0; i<900; i++){
            const s = seed();
            const maxL = 300+Math.random()*300;
            parts.push({x:s.x, y:s.y, life:Math.floor(Math.random()*maxL), maxLife:maxL, trail:[]});
        }
        rk = null; rt = [];
        setTimeout(() => {
            rk = {x: W*0.2, y: H+60, vx: 0.7, vy: -6.5, done: false};
        }, 700);
    }

    function tick(){
        ctx.clearRect(0, 0, W, H);
        const DS=3, TRAIL=28;

        parts.forEach(p => {
            const {u:u1,v:v1,spd:s1} = vel(p.x, p.y);
            if(s1>0.001){
                const nx=p.x+u1/s1*DS, ny=p.y+v1/s1*DS;
                const {u:u2,v:v2,spd:s2} = vel(nx, ny);
                p.x += (u1/s1+(s2>0.001?u2/s2:u1/s1))*DS*0.5;
                p.y += (v1/s1+(s2>0.001?v2/s2:v1/s1))*DS*0.5;
            }
            p.life++;
            p.trail.push({x:p.x, y:p.y});
            if(p.trail.length>TRAIL) p.trail.shift();
            const dx=p.x-cx, dy=p.y-cy;
            if(dx*dx+dy*dy<R*R*0.95 || p.x>W+20 || p.y<-20 || p.y>H+20 || p.life>p.maxLife){reset(p); return;}
            if(p.trail.length<3) return;
            const {spd} = vel(p.x, p.y);
            const t = Math.min(1, spd*0.48);
            const fi=Math.min(1,p.life/12), fo=Math.min(1,(p.maxLife-p.life)/12);
            ctx.beginPath();
            ctx.moveTo(p.trail[0].x, p.trail[0].y);
            for(let i=1; i<p.trail.length; i++) ctx.lineTo(p.trail[i].x, p.trail[i].y);
            ctx.strokeStyle = col(t, 0.55*fi*fo);
            ctx.lineWidth = 0.9;
            ctx.stroke();
        });

        if(rk && !rk.done){
            rk.x+=rk.vx; rk.y+=rk.vy; rk.vy+=0.016;
            rt.push({x:rk.x, y:rk.y});
            if(rt.length>50) rt.shift();
            rt.forEach((p,i) => {
                const prog=i/rt.length;
                ctx.beginPath(); ctx.arc(p.x,p.y+5,(1-prog)*4,0,Math.PI*2);
                ctx.fillStyle=col(0.9-prog*0.65, prog*0.5); ctx.fill();
            });
            const sz=13;
            ctx.save(); ctx.translate(rk.x, rk.y);
            ctx.beginPath(); ctx.moveTo(0,-sz); ctx.lineTo(sz*0.35,sz*0.5); ctx.lineTo(-sz*0.35,sz*0.5); ctx.closePath();
            ctx.fillStyle='#f1e7ca'; ctx.fill();
            ctx.beginPath(); ctx.moveTo(0,-sz); ctx.lineTo(sz*0.18,-sz*0.25); ctx.lineTo(-sz*0.18,-sz*0.25); ctx.closePath();
            ctx.fillStyle='#00A693'; ctx.fill();
            [-1,1].forEach(s => {
                ctx.beginPath(); ctx.moveTo(s*sz*0.35,sz*0.5); ctx.lineTo(s*sz*0.78,sz); ctx.lineTo(s*sz*0.35,sz*0.1); ctx.closePath();
                ctx.fillStyle='#00A693'; ctx.fill();
            });
            ctx.restore();
            if(rk.y < -80) rk.done = true;
        }

        requestAnimationFrame(tick);
    }

    setup();
    window.addEventListener('resize', setup);
    tick();
})();


// ── Scroll reveal ──
const revealEls = document.querySelectorAll('.reveal');

const observer = new IntersectionObserver((entries) => {
    entries.forEach((entry, i) => {
        if (entry.isIntersecting) {
            // Stagger siblings slightly
            const siblings = [...entry.target.parentElement.querySelectorAll('.reveal')];
            const idx = siblings.indexOf(entry.target);
            setTimeout(() => {
                entry.target.classList.add('visible');
            }, idx * 80);
            observer.unobserve(entry.target);
        }
    });
}, { threshold: 0.12 });

revealEls.forEach(el => observer.observe(el));


// ── Mobile menu ──
const menuIcon = document.querySelector('#menu-icon');
const navbar   = document.querySelector('.navbar');

menuIcon.addEventListener('click', () => navbar.classList.toggle('active'));

document.querySelectorAll('.navbar a').forEach(link => {
    link.addEventListener('click', () => navbar.classList.remove('active'));
});


// ── Active nav on scroll ──
const sections = document.querySelectorAll('section');
const navLinks = document.querySelectorAll('.navbar a');

window.addEventListener('scroll', () => {
    let current = '';
    sections.forEach(section => {
        if (window.scrollY >= section.offsetTop - 200) {
            current = section.getAttribute('id');
        }
    });
    navLinks.forEach(link => {
        link.classList.remove('active');
        if (link.getAttribute('href') === '#' + current) {
            link.classList.add('active');
        }
    });
});