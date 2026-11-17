try { var t = localStorage.getItem('arpint.tema'); if (t === 'claro' || t === 'escuro') document.documentElement.dataset.tema = t; } catch (e) {}
