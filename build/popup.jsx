const sentenceInput = document.getElementById("sentence");
const commentInput = document.getElementById("comment");
const addButton = document.getElementById("add");
const listDiv = document.getElementById("list");

function renderList(items) {
  listDiv.innerHTML = "";
  items.forEach((item, i) => {
    const div = document.createElement("div");
    div.className = "item";
    div.textContent = `"${item.sentence}" → ${item.comment}`;
    listDiv.appendChild(div);
  });
}

addButton.addEventListener("click", () => {
  const sentence = sentenceInput.value.trim();
  const comment = commentInput.value.trim();
  if (!sentence || !comment) return;

  chrome.storage.local.get({ annotations: [] }, (data) => {
    const annotations = data.annotations;
    annotations.push({ sentence, comment });
    chrome.storage.local.set({ annotations }, () => {
      renderList(annotations);
      sentenceInput.value = "";
      commentInput.value = "";
    });
  });
});

chrome.storage.local.get({ annotations: [] }, (data) => {
  renderList(data.annotations);
});