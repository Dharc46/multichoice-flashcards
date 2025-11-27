const STORAGE_KEY = 'mc_flashcards_v1';
const MIN_OPTIONS = 2;
const MAX_OPTIONS = 6;

const dom = {
  packForm: document.getElementById('create-pack-form'),
  packNameInput: document.getElementById('pack-name'),
  packList: document.getElementById('pack-list'),
  packCount: document.getElementById('pack-count'),
  questionForm: document.getElementById('question-form'),
  questionPackSelect: document.getElementById('question-pack-select'),
  questionText: document.getElementById('question-text'),
  optionsContainer: document.getElementById('options-container'),
  addOptionBtn: document.getElementById('add-option-btn'),
  questionHelperText: document.getElementById('question-form-hint'),
  bulkImportText: document.getElementById('bulk-import-text'),
  bulkImportBtn: document.getElementById('bulk-import-btn'),
  bulkImportHint: document.getElementById('bulk-import-hint'),
  selectedPackCard: document.getElementById('selected-pack'),
  quizArea: document.getElementById('quiz-area'),
  packTemplate: document.getElementById('pack-item-template'),
  optionTemplate: document.getElementById('option-row-template'),
  resetDataBtn: document.getElementById('reset-data-btn'),
};

const state = {
  packs: [],
  currentPackId: null,
  quizSession: null,
};

init();

function init() {
  bootstrapState();
  bindEvents();
  resetOptionRows();
  renderAll();
}

function handleBulkImport() {
  if (!dom.bulkImportText || !dom.bulkImportHint) return;
  setBulkImportHint('');
  if (!state.packs.length) {
    setBulkImportHint('Chưa có gói nào để thêm câu hỏi.', 'error');
    return;
  }

  const packId = dom.questionPackSelect.value;
  const targetPack = state.packs.find((pack) => pack.id === packId);
  if (!targetPack) {
    setBulkImportHint('Không tìm thấy gói đã chọn.', 'error');
    return;
  }

  const rawInput = dom.bulkImportText.value;
  if (!rawInput.trim()) {
    setBulkImportHint('Vui lòng dán nội dung câu hỏi để nhập nhanh.', 'error');
    dom.bulkImportText.focus();
    return;
  }

  const result = parseBulkImportInput(rawInput);
  if (!result.success) {
    setBulkImportHint(result.message, 'error');
    return;
  }

  result.questions.forEach((question) => {
    targetPack.questions.push(question);
  });
  persistState();
  dom.bulkImportText.value = '';
  setBulkImportHint(`Đã thêm ${result.questions.length} câu hỏi vào "${targetPack.name}".`, 'success');

  if (state.currentPackId === targetPack.id && state.quizSession) {
    state.quizSession = null;
  }

  renderAll();
}

function parseBulkImportInput(rawText) {
  const normalized = rawText.replace(/\r/g, '\n');
  const blocks = normalized
    .split(/\n\s*\n/g)
    .map((block) => block.trim())
    .filter(Boolean);

  if (!blocks.length) {
    return {
      success: false,
      message: 'Không tìm thấy câu hỏi hợp lệ trong nội dung đã nhập.',
    };
  }

  const questions = [];

  for (let index = 0; index < blocks.length; index += 1) {
    const block = blocks[index];
    const lines = block
      .split('\n')
      .map((line) => line.trim())
      .filter((line) => line.length > 0);

    if (lines.length < MIN_OPTIONS + 1) {
      return {
        success: false,
        message: `Khối câu hỏi ${index + 1} cần tối thiểu 1 câu hỏi và ${MIN_OPTIONS} đáp án.`,
      };
    }

    const optionStart = lines.findIndex((line) => /^[-*]/.test(line));
    if (optionStart <= 0) {
      return {
        success: false,
        message: `Khối câu hỏi ${index + 1} thiếu phần câu hỏi hoặc đáp án.`,
      };
    }

    const questionLines = lines.slice(0, optionStart);
    const optionLines = lines.slice(optionStart);
    if (!questionLines.length) {
      return {
        success: false,
        message: `Khối câu hỏi ${index + 1} chưa có nội dung câu hỏi.`,
      };
    }

    if (optionLines.length < MIN_OPTIONS) {
      return {
        success: false,
        message: `Khối câu hỏi ${index + 1} cần ít nhất ${MIN_OPTIONS} đáp án.`,
      };
    }

    if (optionLines.length > MAX_OPTIONS) {
      return {
        success: false,
        message: `Khối câu hỏi ${index + 1} chỉ hỗ trợ tối đa ${MAX_OPTIONS} đáp án.`,
      };
    }

    let correctCount = 0;
    const options = [];

    for (let optIndex = 0; optIndex < optionLines.length; optIndex += 1) {
      const line = optionLines[optIndex];
      const match = line.match(/^([-*])\s*(.+)$/);
      if (!match || !match[2].trim()) {
        return {
          success: false,
          message: `Đáp án ${optIndex + 1} trong khối ${index + 1} không hợp lệ.`,
        };
      }
      const isCorrect = match[1] === '*';
      if (isCorrect) correctCount += 1;
      options.push({
        text: match[2].trim(),
        isCorrect,
      });
    }

    if (correctCount !== 1) {
      return {
        success: false,
        message: `Khối câu hỏi ${index + 1} phải có duy nhất một đáp án đúng (đánh dấu *).`,
      };
    }

    questions.push({
      id: generateId('question'),
      text: questionLines.join('\n'),
      options: options.map((option) => ({
        id: generateId('option'),
        text: option.text,
        isCorrect: option.isCorrect,
      })),
    });
  }

  return {
    success: true,
    questions,
  };
}

function setBulkImportHint(message, variant) {
  if (!dom.bulkImportHint) return;
  dom.bulkImportHint.textContent = message;
  dom.bulkImportHint.classList.remove('error', 'success');
  if (variant === 'error') {
    dom.bulkImportHint.classList.add('error');
  } else if (variant === 'success') {
    dom.bulkImportHint.classList.add('success');
  }
}

function bootstrapState() {
  const stored = localStorage.getItem(STORAGE_KEY);
  if (stored) {
    try {
      const parsed = JSON.parse(stored);
      state.packs = Array.isArray(parsed.packs) ? parsed.packs : [];
      state.currentPackId = parsed.currentPackId ?? null;
    } catch (error) {
      console.warn('Không thể đọc dữ liệu đã lưu, tạo mới.', error);
      state.packs = [];
      state.currentPackId = null;
    }
  }

  if (!state.packs.length) {
    state.packs = createSamplePacks();
    state.currentPackId = null;
    persistState();
  }

  const currentPackExists = state.packs.some((pack) => pack.id === state.currentPackId);
  if (!currentPackExists) {
    state.currentPackId = null;
    persistState();
  }
}

function bindEvents() {
  dom.packForm.addEventListener('submit', handleCreatePack);
  dom.questionForm.addEventListener('submit', handleQuestionSubmit);
  dom.addOptionBtn.addEventListener('click', () => {
    addOptionRow();
  });
  dom.optionsContainer.addEventListener('click', handleOptionsContainerClick);
  dom.bulkImportBtn?.addEventListener('click', handleBulkImport);
  dom.resetDataBtn.addEventListener('click', handleResetData);
}

function handleCreatePack(event) {
  event.preventDefault();
  const name = dom.packNameInput.value.trim();
  if (!name) return;

  const newPack = {
    id: generateId('pack'),
    name,
    questions: [],
  };

  state.packs.push(newPack);
  state.currentPackId = newPack.id;
  persistState();
  dom.packNameInput.value = '';
  renderAll();
}

function handleQuestionSubmit(event) {
  event.preventDefault();
  if (!state.packs.length) return;

  const packId = dom.questionPackSelect.value;
  const targetPack = state.packs.find((pack) => pack.id === packId);
  if (!targetPack) return;

  const rawQuestionText = dom.questionText.value;
  if (!rawQuestionText.trim()) {
    dom.questionText.focus();
    return;
  }

  const optionRows = getOptionRows();
  if (optionRows.length < MIN_OPTIONS) {
    alert(`Cần ít nhất ${MIN_OPTIONS} đáp án.`);
    return;
  }

  const options = optionRows.map((row) => {
    const input = row.querySelector('.option-input');
    const radio = row.querySelector('.option-radio');
    return {
      id: generateId('option'),
      text: input.value.trim(),
      isCorrect: radio.checked,
    };
  });

  if (options.some((option) => !option.text)) {
    alert('Vui lòng nhập nội dung cho tất cả đáp án.');
    return;
  }

  const correctCount = options.filter((option) => option.isCorrect).length;
  if (correctCount !== 1) {
    alert('Chỉ được chọn duy nhất một đáp án đúng.');
    return;
  }

  const newQuestion = {
    id: generateId('question'),
    text: rawQuestionText,
    options,
  };

  targetPack.questions.push(newQuestion);
  persistState();
  dom.questionText.value = '';
  resetOptionRows();
  if (state.currentPackId === targetPack.id && state.quizSession) {
    state.quizSession = null;
  }
  renderAll();
}

function handleOptionsContainerClick(event) {
  if (event.target.matches('.option-remove-btn')) {
    const rows = getOptionRows();
    if (rows.length <= MIN_OPTIONS) {
      alert(`Cần ít nhất ${MIN_OPTIONS} đáp án.`);
      return;
    }
    const row = event.target.closest('.option-row');
    row?.remove();
    ensureCorrectOptionExists();
    updateOptionIndices();
  }
}

function handleResetData() {
  const confirmed = confirm('Bạn có chắc chắn muốn xóa toàn bộ dữ liệu đã lưu?');
  if (!confirmed) return;
  localStorage.removeItem(STORAGE_KEY);
  window.location.reload();
}

function startQuizForPack(packId) {
  const pack = state.packs.find((candidate) => candidate.id === packId);
  state.currentPackId = pack ? pack.id : null;
  persistState();

  if (!pack) {
    state.quizSession = null;
    renderAll();
    return;
  }

  if (!pack.questions.length) {
    state.quizSession = null;
    renderAll();
    return;
  }

  state.quizSession = {
    packId: pack.id,
    currentIndex: 0,
    correctCount: 0,
    questions: shuffle(pack.questions).map((question) => ({
      id: question.id,
      text: question.text,
      options: shuffle(question.options).map((option) => ({ ...option })),
    })),
    completed: false,
  };

  renderAll();
}

function handleAnswerSelection(optionId, isCorrect) {
  const session = state.quizSession;
  if (!session || session.completed) return;
  const currentQuestion = session.questions[session.currentIndex];
  if (currentQuestion.selectedOptionId) return;

  currentQuestion.selectedOptionId = optionId;
  currentQuestion.wasCorrect = Boolean(isCorrect);
  if (isCorrect) {
    session.correctCount += 1;
  }
  renderQuizArea();
}

function handleNextStep() {
  const session = state.quizSession;
  if (!session) return;
  const isLastQuestion = session.currentIndex >= session.questions.length - 1;
  if (isLastQuestion) {
    session.completed = true;
  } else {
    session.currentIndex += 1;
  }
  renderQuizArea();
}

function addOptionRow(value = '', isCorrect = false) {
  if (getOptionRows().length >= MAX_OPTIONS) return;
  const clone = dom.optionTemplate.content.firstElementChild.cloneNode(true);
  const index = getOptionRows().length;
  const input = clone.querySelector('.option-input');
  const radio = clone.querySelector('.option-radio');
  input.value = value;
  radio.checked = isCorrect;
  clone.querySelector('.option-index').textContent = indexLabel(index);
  dom.optionsContainer.appendChild(clone);
  ensureCorrectOptionExists();
  updateOptionIndices();
}

function resetOptionRows() {
  dom.optionsContainer.innerHTML = '';
  for (let i = 0; i < 4; i += 1) {
    addOptionRow('', i === 0);
  }
  updateOptionIndices();
}

function ensureCorrectOptionExists() {
  const radios = dom.optionsContainer.querySelectorAll('.option-radio');
  if (![...radios].some((radio) => radio.checked) && radios[0]) {
    radios[0].checked = true;
  }
}

function getOptionRows() {
  return Array.from(dom.optionsContainer.querySelectorAll('.option-row'));
}

function updateOptionIndices() {
  const rows = getOptionRows();
  rows.forEach((row, index) => {
    const label = row.querySelector('.option-index');
    if (label) {
      label.textContent = indexLabel(index);
    }
  });
  dom.addOptionBtn.disabled = rows.length >= MAX_OPTIONS;
}

function renderAll() {
  renderPackList();
  renderPackCount();
  renderQuestionPackSelect();
  updateQuestionFormState();
  renderSelectedPackCard();
  renderQuizArea();
}

function renderPackList() {
  dom.packList.innerHTML = '';
  if (!state.packs.length) {
    dom.packList.appendChild(createEmptyState('Chưa có gói nào, hãy tạo gói đầu tiên.'));
    return;
  }

  state.packs.forEach((pack) => {
    const item = document.createElement('li');
    item.className = 'pack-item';

    const selectButton = document.createElement('button');
    selectButton.className = 'pack-btn';
    if (state.currentPackId === pack.id) {
      selectButton.classList.add('active');
    }

    const name = document.createElement('strong');
    name.textContent = pack.name;

    const meta = document.createElement('span');
    meta.textContent = `${pack.questions.length} câu hỏi`;

    selectButton.appendChild(name);
    selectButton.appendChild(meta);
    selectButton.addEventListener('click', () => startQuizForPack(pack.id));

    const deleteButton = document.createElement('button');
    deleteButton.className = 'icon-btn';
    deleteButton.title = 'Xóa gói';
    deleteButton.textContent = '🗑';
    deleteButton.addEventListener('click', () => {
      const confirmed = confirm(`Xóa gói "${pack.name}"?`);
      if (confirmed) {
        deletePack(pack.id);
      }
    });

    item.appendChild(selectButton);
    const renameButton = document.createElement('button');
    renameButton.className = 'icon-btn';
    renameButton.title = 'Đổi tên gói';
    renameButton.textContent = '✏️';
    renameButton.addEventListener('click', () => renamePack(pack.id));
    item.appendChild(renameButton);
    item.appendChild(deleteButton);
    dom.packList.appendChild(item);
  });
}

function renderPackCount() {
  const count = state.packs.length;
  dom.packCount.textContent = count === 1 ? '1 gói' : `${count} gói`;
}

function renderQuestionPackSelect() {
  dom.questionPackSelect.innerHTML = '';
  if (!state.packs.length) {
    const option = document.createElement('option');
    option.textContent = 'Chưa có gói nào';
    option.disabled = true;
    option.selected = true;
    dom.questionPackSelect.appendChild(option);
    return;
  }

  state.packs.forEach((pack) => {
    const option = document.createElement('option');
    option.value = pack.id;
    option.textContent = pack.name;
    dom.questionPackSelect.appendChild(option);
  });

  const preferredPackId = state.currentPackId ?? state.packs[0].id;
  dom.questionPackSelect.value = dom.questionPackSelect.querySelector(`option[value="${preferredPackId}"]`)
    ? preferredPackId
    : state.packs[0].id;
}

function updateQuestionFormState() {
  const hasPacks = state.packs.length > 0;
  const inputs = dom.questionForm.querySelectorAll('input, textarea, select, button');
  inputs.forEach((input) => {
    input.disabled = !hasPacks;
  });
  dom.questionForm.classList.toggle('is-disabled', !hasPacks);
  dom.questionHelperText.textContent = hasPacks
    ? 'Điền câu hỏi, ít nhất hai đáp án và chọn đáp án đúng duy nhất.'
    : 'Tạo ít nhất một gói để bắt đầu thêm câu hỏi.';
}

function renderSelectedPackCard() {
  dom.selectedPackCard.innerHTML = '';
  const pack = getCurrentPack();
  if (!pack) {
    dom.selectedPackCard.appendChild(createEmptyState('Chọn một gói từ danh sách để xem chi tiết.'));
    return;
  }

  const title = document.createElement('h3');
  title.textContent = pack.name;

  const meta = document.createElement('p');
  meta.className = 'helper-text';
  meta.textContent = `${pack.questions.length} câu hỏi trong gói này.`;

  dom.selectedPackCard.appendChild(title);
  dom.selectedPackCard.appendChild(meta);

  if (!pack.questions.length) {
    dom.selectedPackCard.appendChild(createEmptyState('Gói chưa có câu hỏi, hãy thêm ở biểu mẫu bên cạnh.'));
    return;
  }

  const actions = document.createElement('div');
  actions.className = 'actions-row';

  const restartButton = document.createElement('button');
  restartButton.className = 'primary-btn';
  restartButton.textContent = 'Chơi lại gói này';
  restartButton.addEventListener('click', () => startQuizForPack(pack.id));

  actions.appendChild(restartButton);
  dom.selectedPackCard.appendChild(actions);
}

function renderQuizArea() {
  dom.quizArea.innerHTML = '';
  const pack = getCurrentPack();
  if (!pack) {
    dom.quizArea.appendChild(createEmptyState('Hãy chọn một gói để luyện tập.'));
    return;
  }

  if (!pack.questions.length) {
    dom.quizArea.appendChild(createEmptyState('Gói này chưa có câu hỏi nào.'));
    return;
  }

  const session = state.quizSession;
  if (!session || session.packId !== pack.id) {
    dom.quizArea.appendChild(createEmptyState('Chọn "Chơi lại gói này" hoặc nhấn gói ở danh sách để bắt đầu.'));
    return;
  }

  if (session.completed) {
    const summary = document.createElement('div');
    summary.className = 'quiz-summary';

    const title = document.createElement('h3');
    title.textContent = 'Hoàn thành!';

    const score = document.createElement('p');
    score.innerHTML = `Bạn trả lời đúng <strong>${session.correctCount}/${session.questions.length}</strong> câu.`;

    const restartButton = document.createElement('button');
    restartButton.className = 'primary-btn';
    restartButton.textContent = 'Luyện lại gói này';
    restartButton.addEventListener('click', () => startQuizForPack(pack.id));

    summary.appendChild(title);
    summary.appendChild(score);
    summary.appendChild(restartButton);
    dom.quizArea.appendChild(summary);
    return;
  }

  const question = session.questions[session.currentIndex];

  const progress = document.createElement('div');
  progress.className = 'quiz-progress';
  progress.innerHTML = `<span>Câu ${session.currentIndex + 1}/${session.questions.length}</span>`;

  const prompt = document.createElement('h3');
  prompt.className = 'question-text';
  prompt.textContent = question.text;

  const optionsWrapper = document.createElement('div');
  optionsWrapper.className = 'quiz-options';

  question.options.forEach((option) => {
    const button = document.createElement('button');
    button.className = 'quiz-option-btn';
    button.textContent = option.text;
    button.type = 'button';

    if (question.selectedOptionId) {
      button.disabled = true;
      if (option.isCorrect) {
        button.classList.add('correct');
      }
      if (option.id === question.selectedOptionId) {
        button.classList.add(option.isCorrect ? 'correct' : 'incorrect');
      }
    } else {
      button.addEventListener('click', () => handleAnswerSelection(option.id, option.isCorrect));
    }

    optionsWrapper.appendChild(button);
  });

  dom.quizArea.appendChild(progress);
  dom.quizArea.appendChild(prompt);
  dom.quizArea.appendChild(optionsWrapper);

  if (question.selectedOptionId) {
    const feedback = document.createElement('p');
    feedback.className = `feedback ${question.wasCorrect ? 'success' : 'error'}`;
    feedback.textContent = question.wasCorrect ? 'Chính xác!' : 'Chưa đúng, thử câu tiếp theo.';

    const nextButton = document.createElement('button');
    nextButton.className = 'primary-btn';
    nextButton.textContent = session.currentIndex < session.questions.length - 1 ? 'Câu tiếp theo' : 'Xem kết quả';
    nextButton.addEventListener('click', handleNextStep);

    dom.quizArea.appendChild(feedback);
    dom.quizArea.appendChild(nextButton);
  }
}

function deletePack(packId) {
  const index = state.packs.findIndex((pack) => pack.id === packId);
  if (index === -1) return;
  state.packs.splice(index, 1);
  if (state.currentPackId === packId) {
    state.currentPackId = state.packs[0]?.id ?? null;
    state.quizSession = null;
  }
  persistState();
  renderAll();
}

function renamePack(packId) {
  const pack = state.packs.find((item) => item.id === packId);
  if (!pack) return;

  const newName = prompt('Nhập tên mới cho gói', pack.name);
  if (newName === null) return;
  const trimmed = newName.trim();
  if (!trimmed || trimmed === pack.name) return;

  pack.name = trimmed;
  persistState();
  renderAll();
}

function getCurrentPack() {
  if (!state.currentPackId) return null;
  return state.packs.find((pack) => pack.id === state.currentPackId) ?? null;
}

function persistState() {
  const payload = {
    packs: state.packs,
    currentPackId: state.currentPackId,
  };
  localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
}

function shuffle(list) {
  const clone = [...list];
  for (let i = clone.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [clone[i], clone[j]] = [clone[j], clone[i]];
  }
  return clone;
}

function indexLabel(index) {
  return String.fromCharCode(65 + index);
}

function createEmptyState(message) {
  const item = document.createElement('p');
  item.className = 'empty-state';
  item.textContent = message;
  return item;
}

function generateId(prefix) {
  const random = Math.random().toString(36).slice(2, 8);
  const timestamp = Date.now().toString(36);
  return `${prefix}-${random}${timestamp}`;
}

function createSamplePacks() {
  const samplePackId = generateId('pack');
  return [
    {
      id: samplePackId,
      name: 'Ôn tập kiến thức chung',
      questions: [
        {
          id: generateId('question'),
          text: 'HTML được dùng để làm gì?',
          options: [
            { id: generateId('option'), text: 'Tạo cấu trúc nội dung web', isCorrect: true },
            { id: generateId('option'), text: 'Lưu trữ dữ liệu trên server', isCorrect: false },
            { id: generateId('option'), text: 'Xử lý logic phía backend', isCorrect: false },
            { id: generateId('option'), text: 'Thiết kế hệ điều hành', isCorrect: false },
          ],
        },
        {
          id: generateId('question'),
          text: 'CSS viết tắt của cụm từ nào?',
          options: [
            { id: generateId('option'), text: 'Cascading Style Sheets', isCorrect: true },
            { id: generateId('option'), text: 'Creative Style System', isCorrect: false },
            { id: generateId('option'), text: 'Computer Styled Syntax', isCorrect: false },
            { id: generateId('option'), text: 'Central Styling Service', isCorrect: false },
          ],
        },
        {
          id: generateId('question'),
          text: 'JavaScript chạy chủ yếu ở đâu?',
          options: [
            { id: generateId('option'), text: 'Trình duyệt và môi trường như Node.js', isCorrect: true },
            { id: generateId('option'), text: 'Chỉ trên database', isCorrect: false },
            { id: generateId('option'), text: 'Chỉ trên thiết bị di động', isCorrect: false },
            { id: generateId('option'), text: 'Trên router mạng', isCorrect: false },
          ],
        },
      ],
    },
  ];
}
