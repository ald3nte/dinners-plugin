/* global chrome */
import React, { useState, useEffect } from "react";
import { supabase } from './utils/supabase'

export default function Popup() {

  const [sentence, setSentence] = useState("");
  const [comment, setComment] = useState("");
  const [name, setName] = useState("");
  const [dinners, setDinners] = useState([]);
  const [expanded, setExpanded] = useState({}); // id: true/false
  const [comments, setComments] = useState({}); // id: [comments]
  const [imageFile, setImageFile] = useState(null);
  const [imagePreview, setImagePreview] = useState(null);

  useEffect(() => {
    chrome.storage.local.get({ name: "" }, (data) => {
      setName(data.name);
    });
    // Pobierz listę dań z Supabase
    const fetchDinners = async () => {
      const { data, error } = await supabase.rpc('get_dinner_list2');
      if (!error && data) {
        setDinners(data);
      } else {
        setDinners([]);
        if (error) alert('Błąd pobierania dań: ' + error.message);
      }
    };
    fetchDinners();
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
      // Odśwież listę dań po dodaniu
      const { data, error: fetchError } = await supabase.rpc('get_dinner_list2');
      if (!fetchError && data) {
        setDinners(data);
      }
    } else {
      alert('Błąd zapisu do bazy: ' + error.message);
    }
  };

  // Funkcja pobierająca komentarze dla dania po id
  const fetchComments = async (dinnerId) => {
    if (comments[dinnerId]) return; // już pobrane
    const { data, error } = await supabase
      .from('comment')
      .select('id,text')
      .eq('dinner_id', dinnerId);
    if (!error && data) {
      setComments(prev => ({ ...prev, [dinnerId]: data }));
    } else {
      setComments(prev => ({ ...prev, [dinnerId]: [] }));
      if (error) alert('Błąd pobierania komentarzy: ' + error.message);
    }
  };

  // Funkcja usuwająca komentarz po id
  const deleteComment = async (commentId, dinnerId) => {
    const { error } = await supabase
      .from('comment')
      .delete()
      .eq('id', commentId);
    if (!error) {
      // Odśwież komentarze dla dania (poczekaj na pobranie i ustawienie)
      const { data, error: fetchError } = await supabase
        .from('comment')
        .select('id,text')
        .eq('dinner_id', dinnerId);
      if (!fetchError && data) {
        setComments(prev => ({ ...prev, [dinnerId]: data }));
      } else {
        setComments(prev => ({ ...prev, [dinnerId]: [] }));
      }
    } else {
      alert('Błąd usuwania komentarza: ' + error.message);
    }
  };

  return (
    <div style={{ fontFamily: "sans-serif", width: 340, background: "#fff", borderRadius: 12, boxShadow: "0 2px 12px #0002", padding: 18 }}>
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
      <h3 style={{ color: "#2a7ae2", marginBottom: 8 }}>Lista dań</h3>
      <div style={{ maxHeight: 220, overflowY: "auto", background: "#f8f8f8", borderRadius: 8, boxShadow: "0 1px 4px #0001", padding: 8 }}>
        {dinners.length === 0 ? (
          <div style={{ color: "#888", textAlign: "center", padding: 12 }}>Brak dań</div>
        ) : (
          dinners.map((item, i) => (
            <div key={item.id} style={{
              margin: "8px 0",
              padding: 10,
              background: "#eaf1fb",
              borderRadius: 7,
              boxShadow: "0 1px 2px #0001"
            }}>
              <div
                style={{ fontWeight: "bold", color: "#2a7ae2", cursor: "pointer" }}
                onClick={async () => {
                  setExpanded(prev => ({ ...prev, [item.id]: !prev[item.id] }));
                  if (!expanded[item.id]) await fetchComments(item.id);
                }}
              >
                {item.sentence}
              </div>
              {expanded[item.id] && (
                <div style={{ marginTop: 8, background: "#fff", borderRadius: 6, boxShadow: "0 1px 2px #0001", padding: 8 }}>
                  {comments[item.id] && comments[item.id].length > 0 ? (
                    comments[item.id].map(c => (
                      <div key={c.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", borderBottom: "1px solid #eee", padding: "4px 0" }}>
                        <span>{c.text}</span>
                        <span
                          style={{ color: "#e22", fontWeight: "bold", cursor: "pointer", marginLeft: 10 }}
                          title="Usuń komentarz"
                          onClick={() => deleteComment(c.id, item.id)}
                        >
                          &#10006;
                        </span>
                      </div>
                    ))
                  ) : (
                    <div style={{ color: "#888", fontSize: 13 }}>Brak komentarzy</div>
                  )}
                </div>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
}
