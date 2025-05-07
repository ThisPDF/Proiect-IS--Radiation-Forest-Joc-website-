# 🌲 Radiation Forest: Joc Website

**Radiation Forest** este un proiect de tip website pentru un joc video conceptual, dezvoltat ca parte a unui proiect universitar. Platforma folosește Next.js pentru front-end și include o interfață modernă și responsivă cu componente UI personalizate.

## 🔧 Tehnologii folosite

- [Next.js](https://nextjs.org/)
- [React](https://react.dev/)
- [TypeScript](https://www.typescriptlang.org/)
- [Tailwind CSS](https://tailwindcss.com/)
- [shadcn/ui](https://ui.shadcn.dev/) – componente UI moderne
- pnpm (manager de pachete performant)

## ▶️ Rulare locală

1. Asigură-te că ai instalat [Node.js](https://nodejs.org/) și [pnpm](https://pnpm.io/).

2. Clonează acest repository și instalează dependențele:

   ```bash
   pnpm install
   ```

3. Pornește serverul de dezvoltare:

   ```bash
   pnpm dev
   ```

4. Accesează aplicația la `http://localhost:3000`.

## 📁 Structură principală

```plaintext
.
├── app/                  # Pagini și layout Next.js
├── components/           # Componente UI reutilizabile
├── styles/               # Fișiere CSS globale
├── public/               # Resurse statice (imagini, etc.)
├── game-concept.tsx      # Componentă ce definește conceptul de joc
├── tailwind.config.ts    # Configurare Tailwind
├── tsconfig.json         # Configurare TypeScript
├── package.json          # Configurare proiect
└── pnpm-lock.yaml        # Lockfile pnpm
```

## 🕹️ Descriere funcțională

Aplicația oferă o interfață stilizată care prezintă conceptul jocului *Radiation Forest*, un joc cu elemente de strategie și supraviețuire într-un mediu post-apocaliptic. Conține o structură modulară cu componente de tip `Card`, `Tabs`, `Dialog`, etc., ușor de extins pentru funcționalități viitoare.

## 📌 Status

✅ Interfață funcțională  
🛠️ Gameplay-ul propriu-zis urmează a fi integrat

## 👤 Autor

**Popescu Florin Daniel**  
Universitatea Politehnica din București – Facultatea de Inginerie Industrială și Robotică  
GitHub: [@ThisPDF](https://github.com/ThisPDF)  
LinkedIn: [Daniel Popescu](https://www.linkedin.com/in/daniel-popescu-460519246/)

---

📁 Proiect realizat în cadrul cursului de Ingineria Sistemelor Informatice pentru VR (ISIVR).
