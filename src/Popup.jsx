/* global chrome */
import React, { useState, useEffect } from "react";
import { supabase } from './utils/supabase'

export default function Popup() {

  const [sentence, setSentence] = useState("");
  const [comment, setComment] = useState("");
  const [name, setName] = useState("");
  const [annotations, setAnnotations] = useState([]);
  const [imageFile, setImageFile] = useState(null);
  const [imagePreview, setImagePreview] = useState(null);

  useEffect(() => {
    chrome.storage.local.get({ name: "" }, (data) => {
      setName(data.name);
    });
    // Pobierz adnotacje z Supabase
    const fetchAnnotations = async () => {
      const { data, error } = await supabase.rpc('get_dinner_list');
      if (!error && data) {
        setAnnotations(data.map(row => ({
          sentence: row.sentence,
          name: row.person,
          image: row.image // zakładam, że masz pole image w bazie
        })));
      } else {
        setAnnotations([]);
        if (error) alert('Błąd pobierania adnotacji: ' + error.message);
      }
    };
    fetchAnnotations();
  }, []);

  const handleNameChange = (e) => {
    const newName = e.target.value;
    setName(newName);
    chrome.storage.local.set({ name: newName });
  };

  const handleImageChange = (e) => {
    const file = e.target.files[0];
    setImageFile(file);
    if (file) {
      const reader = new FileReader();
      reader.onload = ev => setImagePreview(ev.target.result);
      reader.readAsDataURL(file);
    } else {
      setImagePreview(null);
    }
  };

  // Funkcja do kompresji obrazu do miniaturki (max 200x200px)
  const compressImage = (file, maxSize = 200) => {
    return new Promise((resolve, reject) => {
      const img = new window.Image();
      const reader = new FileReader();
      reader.onload = (e) => {
        img.onload = () => {
          const canvas = document.createElement('canvas');
          let width = img.width;
          let height = img.height;
          if (width > height) {
            if (width > maxSize) {
              height = Math.round(height * (maxSize / width));
              width = maxSize;
            }
          } else {
            if (height > maxSize) {
              width = Math.round(width * (maxSize / height));
              height = maxSize;
            }
          }
          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          ctx.drawImage(img, 0, 0, width, height);
          canvas.toBlob(
            (blob) => {
              if (blob) resolve(blob);
              else reject(new Error('Błąd kompresji obrazu.'));
            },
            'image/jpeg',
            0.8 // jakość
          );
        };
        img.onerror = reject;
        img.src = e.target.result;
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  };

  const addAnnotation = async () => {
    if (!sentence.trim() || !comment.trim() || !name.trim()) return;

    let imageUrl = null;
    if (imageFile) {
      const fileExt = 'jpg'; // zawsze jpg po kompresji
      const fileName = `${Date.now()}_${Math.random().toString(36).substr(2, 9)}.${fileExt}`;
      let compressedBlob;
      try {
        compressedBlob = await compressImage(imageFile, 200);
      } catch (err) {
        alert('Błąd kompresji zdjęcia: ' + err.message);
        return;
      }
      const { data, error: uploadError } = await supabase.storage
        .from('dinner')
        .upload(fileName, compressedBlob, { contentType: 'image/jpeg' });

      if (uploadError) {
        alert('Błąd uploadu zdjęcia: ' + uploadError.message);
        return;
      }
      imageUrl = supabase.storage.from('dinner').getPublicUrl(fileName).data.publicUrl;
    }

    const { error } = await supabase.rpc('insert_comment', {
      p_sentence: sentence,
      p_comment: comment,
      p_person: name,
      p_image: imageUrl // dodaj pole w funkcji Supabase!
    });
    if (!error) {
      setSentence("");
      setComment("");
      setImageFile(null);
      setImagePreview(null);
      // Odśwież adnotacje po dodaniu
      const { data, error: fetchError } = await supabase.rpc('get_dinner_list');
      if (!fetchError && data) {
        setAnnotations(data.map(row => ({
          sentence: row.sentence,
          name: row.person,
          image: row.image
        })));
      }
    } else {
      alert('Błąd zapisu do bazy: ' + error.message);
    }
  };

  return (
    <div style={{ fontFamily: "sans-serif", width: 320, background: "#fff", borderRadius: 12, boxShadow: "0 2px 12px #0002", padding: 18 }}>
      <h2 style={{ textAlign: "center", color: "#3a3a3a", marginBottom: 10 }}>Adnotacje do obiadków</h2>
      <div style={{ marginBottom: 16, background: "#f8f8f8", borderRadius: 8, padding: 12, boxShadow: "0 1px 4px #0001" }}>
        <h3 style={{ margin: "0 0 8px 0", color: "#2a7ae2" }}>Podaj imię</h3>
        <input
          value={name}
          onChange={handleNameChange}
          placeholder="Imię"
          style={{ width: "100%", margin: "5px 0 10px 0", padding: "8px", borderRadius: 6, border: "1px solid #d0d0d0" }}
        />
        <h3 style={{ margin: "0 0 8px 0", color: "#2a7ae2" }}>Dodaj adnotację</h3>
        <input
          value={sentence}
          onChange={e => setSentence(e.target.value)}
          placeholder="Zdanie"
          style={{ width: "100%", margin: "5px 0", padding: "8px", borderRadius: 6, border: "1px solid #d0d0d0" }}
        />
        <textarea
          value={comment}
          onChange={e => setComment(e.target.value)}
          placeholder="Komentarz"
          style={{ width: "100%", margin: "5px 0 10px 0", padding: "8px", borderRadius: 6, border: "1px solid #d0d0d0", minHeight: 60, resize: "vertical" }}
        />
        <input
          type="file"
          accept="image/*"
          onChange={handleImageChange}
          style={{ width: "100%", margin: "5px 0 10px 0" }}
        />
        {imagePreview && (
          <img
            src={imagePreview}
            alt="miniaturka"
            style={{ width: 80, height: 80, objectFit: "cover", borderRadius: 8, marginBottom: 10 }}
          />
        )}
        <button
          onClick={addAnnotation}
          style={{ width: "100%", padding: "10px", background: "#2a7ae2", color: "#fff", border: "none", borderRadius: 6, fontWeight: "bold", fontSize: 16, cursor: "pointer", marginTop: 6 }}
        >
          Dodaj
        </button>
      </div>
      <h3 style={{ color: "#2a7ae2", marginBottom: 8 }}>Skomentowane obiady</h3>
      <div style={{ maxHeight: 180, overflowY: "auto", background: "#f8f8f8", borderRadius: 8, boxShadow: "0 1px 4px #0001", padding: 8 }}>
        {annotations.length === 0 ? (
          <div style={{ color: "#888", textAlign: "center", padding: 12 }}>Brak adnotacji</div>
        ) : (
          annotations.map((item, i) => (
            <div key={i} style={{
              margin: "8px 0",
              padding: 10,
              background: "#eaf1fb",
              borderRadius: 7,
              boxShadow: "0 1px 2px #0001"
            }}>
              <div style={{ fontWeight: "bold", color: "#2a7ae2" }}>
                {item.sentence}
              </div>
              <div style={{ fontSize: "0.95em", color: "#444", marginTop: 4 }}>
                {item.image && (
                  <img
                    src={item.image}
                    alt="miniaturka"
                    style={{ width: 60, height: 60, objectFit: "cover", borderRadius: 6, marginTop: 6 }}
                  />
                )}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
