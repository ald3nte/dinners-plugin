// Załaduj Fuse.js
// Fuse.js musi być dodany jako pierwszy w manifest.json content_scripts

function highlightAnnotations(annotations) {
  console.log('[Dinner Plugin] Plugin aktywowany na stronie:', window.location.href);
  if (!window.Fuse) {
    console.error('Fuse.js not loaded!');
    return;
  }
  // Zbuduj listę zdań do wyszukiwania
  const sentences = annotations.map(a => a.sentence);
  const fuse = new Fuse(sentences, {
    includeScore: true,
    threshold: 0.4 // tolerancja błędu, im wyższa tym większa tolerancja
  });

    // Dynamiczny wybór targets na podstawie URL i daty poniedziałku
    let targets = [];
    const path = window.location.pathname;
    // Funkcja do wyznaczenia daty poniedziałku (YYYY-MM-DD) dla danego tygodnia
    function getMonday(date) {
      const d = new Date(date);
      const day = d.getDay();
      const diff = d.getDate() - day + (day === 0 ? -6 : 1); // Monday
      const monday = new Date(d.setDate(diff));
      return monday.toISOString().slice(0, 10);
    }

  // Poniedziałek tego tygodnia
  const today = new Date();
  const mondayDate = new Date(getMonday(today));
  const mondayThisWeek = mondayDate.toISOString().slice(0, 10);
  // Poniedziałek przyszłego tygodnia = mondayThisWeek + 7 dni
  const mondayNextWeekDate = new Date(mondayDate.getTime() + 7 * 24 * 60 * 60 * 1000);
  const mondayNextWeek = mondayNextWeekDate.toISOString().slice(0, 10);

    if (path === '/main/show_by_floor') {
      targets = [...document.querySelectorAll('.day_meals .meal')];
    } else if (path === `/main/render_make_order/${mondayThisWeek}`) {
      targets = [...document.querySelectorAll('ul.day li.float_left ul.suppliers_content li')];
    } else if (path === `/main/render_make_order/${mondayNextWeek}`) {
      targets = [...document.querySelectorAll('li.meal_item label')];
    } else {
      targets = [...document.querySelectorAll('ul.day li.float_left ul.suppliers_content li')];
    }

    function stripPrefixes(text) {
      return text
            .replace(/^\s*(Dirett - |Zwierzyniec - )/i, "")
            .replace(/["\s]+$/g, "");
    }

    function highlightTextInNode(node, sentence, comment, image) {
      if (!node.nodeValue) return false;
      const cleanSentence = sentence.replace(/\s+/g, "");
      let cleanText = node.nodeValue.replace(/\s+/g, "");
      cleanText = stripPrefixes(cleanText);
      if (node.nodeType === Node.TEXT_NODE && new RegExp(cleanSentence, "i").test(cleanText)) {
        const origRegex = new RegExp(sentence.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i");
        const matchArr = node.nodeValue.match(origRegex);
        if (!matchArr) return false;
        const match = matchArr[0];
        // Tworzymy <p> z odpowiednimi stylami i całą zawartością
        const p = document.createElement("p");
        p.style.display = "inline";
        p.style.textDecoration = "underline";
        p.style.cursor = "help";
        p.title = comment;
        // Dodaj tekst przed dopasowaniem
        const before = node.nodeValue.slice(0, matchArr.index);
        if (before) p.appendChild(document.createTextNode(before));
        // Dodaj dopasowanie (bez spana)
        p.appendChild(document.createTextNode(match));
        // Jeśli jest obrazek, dodaj <img>
        if (image) {
          const img = document.createElement("img");
          img.src = image;
          img.alt = "miniaturka";
          img.style.width = "32px";
          img.style.height = "32px";
          img.style.objectFit = "cover";
          img.style.borderRadius = "4px";
          img.style.marginLeft = "6px";
          img.style.verticalAlign = "middle";
          img.style.cursor = "pointer";
          img.addEventListener('click', e => {
            e.stopPropagation();
            window.open(image, '_blank');
          });
          p.appendChild(img);
        }
        // Dodaj tekst po dopasowaniu
        const after = node.nodeValue.slice(matchArr.index + match.length);
        if (after) p.appendChild(document.createTextNode(after));
        if (node.parentNode) {
          node.parentNode.replaceChild(p, node);
        }
        return true;
      }
      return false;
    }

    targets.forEach(element => {
      // Pomiń label, jeśli znajduje się w ul.day li.float_left ul.suppliers_content li:nth-child(3) li.meal_item label
      if (
        element.matches('li.meal_item label') &&
        element.closest('ul.suppliers_content li:nth-child(3) li.meal_item label')
      ) {
        return;
      }
      let found = false;

      // Pozostałe elementy jak dotychczas
      element.childNodes.forEach(child => {
        annotations.forEach(({ sentence, comment, image }) => {
          if (highlightTextInNode(child, sentence, comment, image)) {
            found = true;
          }
        });
      });
      if (!found) {
        let text = element.textContent;
        const strippedText = stripPrefixes(text);
        const result = fuse.search(strippedText);
        if (result.length > 0) {
          // Wybierz najlepszy wynik po najniższym score
          const best = result.reduce((min, curr) => (curr.score < min.score ? curr : min), result[0]);
          const fuzzySentence = best.item;
          const comment = annotations[best.refIndex].comment;
          const image = annotations[best.refIndex].image;
          // Podmień cały tekst elementu na <p> z komentarzem i stylami
          if (best.score < 0.4) {
            const p = document.createElement("p");
            p.style.display = "inline";
            p.style.textDecoration = "underline";
            p.style.cursor = "help";
            p.title = comment;
            p.appendChild(document.createTextNode(text));
            if (image) {
              const img = document.createElement("img");
              img.src = image;
              img.alt = "miniaturka";
              img.style.width = "32px";
              img.style.height = "32px";
              img.style.objectFit = "cover";
              img.style.borderRadius = "4px";
              img.style.marginLeft = "6px";
              img.style.verticalAlign = "middle";
              img.style.cursor = "pointer";
              img.addEventListener('click', e => {
                e.stopPropagation();
                window.open(image, '_blank');
              });
              p.appendChild(img);
            }
            element.innerHTML = "";
            element.appendChild(p);
          }
        }
      }
    });
}

async function fetchAndHighlightAnnotations() {
  try {
    const { data, error } = await window.supabase.rpc('get_dinner_comments3');
    if (error) {
      console.error('Błąd pobierania adnotacji:', error.message);
      return;
    }
    if (data) {
      highlightAnnotations(data.map(row => ({ sentence: row.sentence, comment: row.comments, image: row.image })));
    }
  } catch (err) {
    console.error('Błąd połączenia z Supabase:', err);
  }
}

// Supabase client jest już dostępny przez window.supabase (załadowany przez manifest.json)
window.supabase = window.supabase.createClient(
  'https://gthhgqycvbyckewqwuyz.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imd0aGhncXljdmJ5Y2tld3F3dXl6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTk0MDcwMTgsImV4cCI6MjA3NDk4MzAxOH0.-8s7gjgx0ueQN00zhA5nfqdvZbqGTGgL8S79M7W0dGA'
);
fetchAndHighlightAnnotations();
