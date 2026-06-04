/**
 * 관리감독자 반기 업무수행 평가 시스템 - GitHub Pages용 script.js v10
 *
 * 핵심 구조
 * - 화면: GitHub Pages
 * - 조직도: Google Sheets '조직도' 시트 A:D를 Apps Script에서 불러옴
 * - 저장: Apps Script → Google Sheets DB
 * - 사진/서명: Google Drive 미사용, Google Sheets 내부 _FILE_INDEX / _FILE_CHUNKS 시트에 압축 저장
 *
 * 사용 전 반드시 아래 APPS_SCRIPT_URL을 본인의 Apps Script 웹앱 URL로 변경하세요.
 */
const APPS_SCRIPT_URL = '여기에_Apps_Script_웹앱_URL을_붙여넣으세요';

const EVALUATION_ITEMS = [
  {
    id: 'q01',
    title: '기계·기구 또는 설비의 안전·보건 점검 및 이상 유무 확인',
    desc: '멀티콘센트, 전등, 자동문, 에어컨, 사다리, 소화기, 리프트, 승강기, 소방설비 등 해당 매장에 있는 설비 기준으로 확인',
    weight: '중',
    scores: { high: 10, mid: null, low: 0 },
    criteria: {
      high: '해당 매장 보유 설비의 점검 또는 유지보수 이력 확인 가능',
      low: '점검자료 없음 또는 이상사항 미조치'
    },
    exampleSrc: 'assets/examples/example_equipment.jpg'
  },
  {
    id: 'q02',
    title: '작업복·보호구 및 방호장치 점검과 착용·사용 교육·지도',
    desc: '보호구 지급대장, TBM 실시, 신규채용 시 교육 실시 여부 확인',
    weight: '중',
    scores: { high: 10, mid: 5, low: 0 },
    criteria: {
      high: '보호구 지급대장 6개월, TBM 실시, 신규채용 시 교육 실시 완료',
      mid: '보호구 지급대장 6개월, TBM 실시, 신규채용 시 교육 중 1가지 미흡',
      low: '보호구 지급대장과 교육·지도 기록 모두 없음'
    },
    exampleSrc: 'assets/examples/example_ppe_register.jpg'
  },
  {
    id: 'q03',
    title: '산업재해 보고 및 응급조치',
    desc: '산업재해 발생 시 즉시 보고, 응급조치, 산업재해조사표 등 관련 서류 제출 여부 확인',
    weight: '상',
    scores: { high: 15, mid: null, low: 0 },
    criteria: {
      high: '산업재해 발생 건 전부 즉시 보고 및 조치 완료',
      low: '미보고 또는 지연 보고가 1건이라도 발생'
    },
    exampleSrc: 'assets/examples/example_accident_report.jpg'
  },
  {
    id: 'q04',
    title: '작업장 정리·정돈 및 통로 확보 확인·감독',
    desc: '순회점검일지 작성, 통로·비상통로 확보, 후방공간 정리정돈 확인',
    weight: '중',
    scores: { high: 10, mid: null, low: 0 },
    criteria: {
      high: '순회점검표 월 4회 이상 작성',
      low: '순회점검일지 미작성 월이 있음'
    },
    exampleSrc: 'assets/examples/example_patrol_log.jpg'
  },
  {
    id: 'q05',
    title: '안전·보건관리자 또는 기관에 대한 협조',
    desc: '안전보건팀 요청사항, 비상대피훈련, 개선요청 사항에 대한 협조 및 이행 여부 확인',
    weight: '중',
    scores: { high: 10, mid: null, low: 0 },
    criteria: {
      high: '비상대피훈련 결과보고 1건 이상 완료',
      low: '훈련은 실시했으나 결과보고 자료 없음'
    },
    exampleSrc: 'assets/examples/example_emergency_training.jpg'
  },
  {
    id: 'q06',
    title: '위험성평가 참여 및 실행',
    desc: '위험성평가 참여자료, 위험요인 확인, 개선조치 실행 내역 확인',
    weight: '상',
    scores: { high: 15, mid: 8, low: 0 },
    criteria: {
      high: '위험성평가 참여자료 및 개선조치 완료 내역 확인',
      mid: '위험성평가는 참여했으나 개선조치 완료 내역 없음',
      low: '위험성평가 미참여 또는 개선조치 미실행'
    },
    exampleSrc: 'assets/examples/example_risk_assessment.jpg'
  },
  {
    id: 'q07',
    title: '법규 및 지침 준수 여부',
    desc: 'ISO 가이드 PDF를 확인한 후 매장 안전보건 절차서, 실행문서, 안전보건서류, 위험표지의 게시·비치·보관 상태 확인',
    weight: '하',
    scores: { high: 5, mid: 3, low: 0 },
    criteria: {
      high: '안전보건 절차서·실행문서·서류·표지 보관/게시 상태 확인 가능',
      mid: '일부 자료 누락 또는 최신화 필요',
      low: '확인 가능한 안전보건 문서·서류·표지 없음'
    },
    guide: {
      href: './ISO가이드.pdf',
      label: '📒 ISO 가이드 PDF 보기'
    }
  }
];
const DOCUMENT_FILE_FIELDS = [];
const EVIDENCE_FILE_FIELDS = EVALUATION_ITEMS.map(function (item) {
  return {
    name: 'evidence_' + item.id,
    label: '판단 증빙사진 - ' + item.title,
    hint: '중 또는 하로 선택한 경우 필요 시 현장 사진 또는 관련 자료를 첨부해주세요.',
    required: false,
    evidenceOnly: true,
    itemId: item.id
  };
});

const ALL_FILE_FIELDS = DOCUMENT_FILE_FIELDS.concat(EVIDENCE_FILE_FIELDS);

let orgTree = {};
let selectedFiles = {};
let hasSignature = false;

const form = document.getElementById('evaluationForm');
const submitBtn = document.getElementById('submitBtn');
const resultMessage = document.getElementById('resultMessage');
const evaluationItemsContainer = document.getElementById('evaluationItems');
const attachmentList = document.getElementById('attachmentList');

const orgLoadMessage = document.getElementById('orgLoadMessage');
const headquarterSelect = document.getElementById('headquarterSelect');
const departmentSelect = document.getElementById('departmentSelect');
const teamSelect = document.getElementById('teamSelect');
const storeSelect = document.getElementById('storeSelect');
const accidentOccurredSelect = null;

const signaturePad = document.getElementById('signaturePad');
const clearSignatureBtn = document.getElementById('clearSignatureBtn');
const signatureWrap = document.querySelector('.signature-pad-wrap');

const loadingOverlay = document.getElementById('loadingOverlay');
const loadingText = document.getElementById('loadingText');
const exampleModal = document.getElementById('exampleModal');
const exampleImage = document.getElementById('exampleImage');
const exampleModalTitle = document.getElementById('exampleModalTitle');
const exampleCaption = document.getElementById('exampleCaption');

let signatureContext;
let signatureDrawing = false;
let lastSignaturePoint = null;

window.addEventListener('DOMContentLoaded', function () {
  renderEvaluationItems();
  bindCascadingOrgSelects();
  bindEvaluationResultChange();
  bindFileInputs();
  bindExampleModal();
  setupSignaturePad();
  loadOrganizationTree();
});

window.addEventListener('resize', debounce(function () {
  resizeSignatureCanvas(true);
}, 250));

form.addEventListener('submit', async function (event) {
  event.preventDefault();

  if (!validateAppsScriptUrl()) return;
  if (!validateOrganizationLoaded()) return;
  if (!validateBasicRequired()) return;
  if (!validateSignature()) return;

  setResult('pending', '제출 준비 중입니다. 사진 압축 및 저장 준비 중입니다.');
  showLoading(true, '사진을 압축하고 제출 자료를 준비 중입니다. 창을 닫지 말고 기다려주세요.');
  submitBtn.disabled = true;
  submitBtn.textContent = '제출 중입니다...';

  try {
    const payload = await buildPayload();

    showLoading(true, '자료를 전송 중입니다. 네트워크 상태에 따라 시간이 걸릴 수 있습니다.');
    await postPayloadByHiddenForm(payload);

    showLoading(true, '자료가 전송되었습니다. 저장 완료 여부를 확인 중입니다.');
    const status = await waitForSaveStatus(payload.submissionId);

    if (status && status.success) {
      const displayScore = formatScoreForDisplay(status.score || payload.score);
      setResult(
        'success',
        `제출 완료되었습니다.<br>제출자: ${escapeHtml(payload.basic.supervisorName)} / 환산점수: ${displayScore}점`
      );
      resetFormAfterSuccess();
    } else {
      throw new Error(status && status.message ? status.message : '저장 상태 확인 실패');
    }
  } catch (error) {
    console.error(error);
    setResult('error', '제출 중 오류가 발생했습니다.<br>' + escapeHtml(error.message));
  } finally {
    submitBtn.disabled = false;
    submitBtn.textContent = '반기평가 제출하기';
    showLoading(false);
  }
});

function renderEvaluationItems() {
  evaluationItemsContainer.innerHTML = EVALUATION_ITEMS.map(function (item, index) {
    const evidenceField = 'evidence_' + item.id;
    const hasMid = item.scores.mid !== null && item.scores.mid !== undefined && item.scores.mid !== '';
    const scoreText = hasMid
      ? `상 ${item.scores.high}점 / 중 ${item.scores.mid}점 / 하 ${item.scores.low}점`
      : `상 ${item.scores.high}점 / 하 ${item.scores.low}점`;

    const criteriaRows = [
      `<div><strong>상</strong><span>${escapeHtml(item.criteria.high)}</span></div>`,
      hasMid ? `<div><strong>중</strong><span>${escapeHtml(item.criteria.mid)}</span></div>` : '',
      `<div><strong>하</strong><span>${escapeHtml(item.criteria.low)}</span></div>`
    ].join('');

    const midOptionHtml = hasMid
      ? `<label class="middle-option"><input type="radio" name="${item.id}_result" value="중" /> 중</label>`
      : '';

    const evidenceHtml = `<div class="item-attachment-panel">
      ${createFilePickerHtml({
        name: evidenceField,
        label: '첨부사진 - ' + item.title,
        hint: '해당 항목 관련 사진이나 자료가 있으면 첨부해주세요.',
        required: false,
        exampleSrc: item.exampleSrc || '',
        guide: item.guide || null
      })}
    </div>`;

    return `
      <div class="check-item" data-item-card="${item.id}">
        <div class="item-title">${index + 1}. ${escapeHtml(item.title)}</div>
        <p class="item-desc">${escapeHtml(item.desc)}</p>
        <div class="score-badge-row">
          <span class="weight-badge">비중 ${escapeHtml(item.weight)}</span>
          <span class="score-badge">${escapeHtml(scoreText)}</span>
        </div>
        <div class="criteria-box">
          ${criteriaRows}
        </div>

        <div class="segmented-control ${hasMid ? 'has-mid' : 'no-mid'}" role="radiogroup" aria-label="${escapeHtml(item.title)} 평가결과">
          <label><input type="radio" name="${item.id}_result" value="상" required checked /> 상</label>
          ${midOptionHtml}
          <label class="insufficient-option"><input type="radio" name="${item.id}_result" value="하" /> 하</label>
        </div>

        ${evidenceHtml}
      </div>
    `;
  }).join('');
}

function renderAttachmentCards() {
  if (!attachmentList) return;
  attachmentList.innerHTML = '';
}

function createFilePickerHtml(field) {
  const inputId = field.name + '_file';
  const hasExample = !!field.exampleSrc;
  const hasGuide = !!(field.guide && field.guide.href);
  const hasSecondAction = hasExample || hasGuide;
  const actionClass = hasSecondAction ? 'photo-actions with-example' : 'photo-actions no-example';
  const secondActionHtml = hasExample
    ? `<button type="button" class="example-btn" data-example-src="${escapeHtml(field.exampleSrc)}" data-example-title="${escapeHtml(field.label)}" data-example-caption="${escapeHtml(field.hint)}">📒 예시</button>`
    : (hasGuide
      ? `<a class="example-btn guide-view-btn" href="${escapeHtml(field.guide.href)}" target="_blank" rel="noopener">${escapeHtml(field.guide.label)}</a>`
      : '');

  return `
    <div class="photo-picker" data-file-picker="${escapeHtml(field.name)}">
      <input class="file-input-hidden" id="${inputId}" type="file" accept="image/*" data-file-field="${escapeHtml(field.name)}" />
      <div class="${actionClass}">
        <label class="photo-btn attach" for="${inputId}">📎 첨부</label>
        ${secondActionHtml}
      </div>
      <div class="preview-row" id="${field.name}_preview">
        <span data-preview-name="${escapeHtml(field.name)}"></span>
        <button type="button" class="clear-file-btn" data-clear-file="${escapeHtml(field.name)}">삭제</button>
      </div>
    </div>
  `;
}

function bindEvaluationResultChange() {
  EVALUATION_ITEMS.forEach(function (item) {
    const radios = form.querySelectorAll(`input[name="${item.id}_result"]`);
    radios.forEach(function (radio) {
      radio.addEventListener('change', function () {
        applyEvaluationItemState(item.id);
      });
    });
    applyEvaluationItemState(item.id);
  });
}

function applyEvaluationItemState(itemId) {
  const checked = form.querySelector(`input[name="${itemId}_result"]:checked`);
  const card = form.querySelector(`[data-item-card="${itemId}"]`);
  const isLow = checked && checked.value === '하';

  if (card) card.classList.toggle('insufficient', !!isLow);
}
function bindCascadingOrgSelects() {
  headquarterSelect.addEventListener('change', function () {
    populateDepartments(headquarterSelect.value);
  });

  departmentSelect.addEventListener('change', function () {
    populateTeams(headquarterSelect.value, departmentSelect.value);
  });

  teamSelect.addEventListener('change', function () {
    populateStores(headquarterSelect.value, departmentSelect.value, teamSelect.value);
  });
}

function loadOrganizationTree() {
  if (!validateAppsScriptUrl(false)) {
    setOrgMessage('error', 'Apps Script URL을 먼저 script.js에 입력해야 조직도를 불러올 수 있습니다.');
    return;
  }

  setOrgMessage('pending', '조직도 정보를 불러오는 중입니다...');

  jsonpRequest({ mode: 'org' }, 30000)
    .then(function (data) {
      if (!data || !data.success) {
        throw new Error(data && data.message ? data.message : '조직도 불러오기 실패');
      }

      orgTree = data.tree || {};
      populateHeadquarters();
      setOrgMessage('success', `조직도 정보를 불러왔습니다. 총 ${data.count || 0}개 매장 기준입니다.`);
    })
    .catch(function (error) {
      console.error(error);
      setOrgMessage('error', '조직도 정보를 불러오지 못했습니다. 조직도 시트명과 Apps Script 배포 권한을 확인해주세요.');
      resetSelect(headquarterSelect, '조직도 불러오기 실패', true);
      resetSelect(departmentSelect, '영업본부를 먼저 선택해주세요', true);
      resetSelect(teamSelect, '부서명을 먼저 선택해주세요', true);
      resetSelect(storeSelect, '팀명을 먼저 선택해주세요', true);
    });
}

function populateHeadquarters() {
  const headquarters = Object.keys(orgTree).sort(koreanSort);
  fillSelect(headquarterSelect, headquarters, '영업본부를 선택해주세요', false);
  resetSelect(departmentSelect, '영업본부를 먼저 선택해주세요', true);
  resetSelect(teamSelect, '부서명을 먼저 선택해주세요', true);
  resetSelect(storeSelect, '팀명을 먼저 선택해주세요', true);
}

function populateDepartments(headquarter) {
  const departments = headquarter && orgTree[headquarter] ? Object.keys(orgTree[headquarter]).sort(koreanSort) : [];
  fillSelect(departmentSelect, departments, '부서명을 선택해주세요', departments.length === 0);
  resetSelect(teamSelect, '부서명을 먼저 선택해주세요', true);
  resetSelect(storeSelect, '팀명을 먼저 선택해주세요', true);
}

function populateTeams(headquarter, department) {
  const teams = headquarter && department && orgTree[headquarter] && orgTree[headquarter][department]
    ? Object.keys(orgTree[headquarter][department]).sort(koreanSort)
    : [];
  fillSelect(teamSelect, teams, '팀명을 선택해주세요', teams.length === 0);
  resetSelect(storeSelect, '팀명을 먼저 선택해주세요', true);
}

function populateStores(headquarter, department, team) {
  const stores = headquarter && department && team && orgTree[headquarter] && orgTree[headquarter][department] && orgTree[headquarter][department][team]
    ? orgTree[headquarter][department][team].slice().sort(koreanSort)
    : [];
  fillSelect(storeSelect, stores, '매장명을 선택해주세요', stores.length === 0);
}

function fillSelect(select, options, placeholder, disabled) {
  select.innerHTML = '';
  const first = document.createElement('option');
  first.value = '';
  first.textContent = placeholder;
  select.appendChild(first);

  options.forEach(function (value) {
    const option = document.createElement('option');
    option.value = value;
    option.textContent = value;
    select.appendChild(option);
  });

  select.disabled = !!disabled;
}

function resetSelect(select, placeholder, disabled) {
  fillSelect(select, [], placeholder, disabled);
}

function resetOrgSelectsAfterSubmit() {
  populateHeadquarters();
}

function setOrgMessage(type, message) {
  orgLoadMessage.className = 'inline-message ' + type;
  orgLoadMessage.textContent = message;
}

function bindAccidentFileRule() {}
function applyAccidentFileRule() {}

function bindFileInputs() {
  document.addEventListener('change', function (event) {
    const input = event.target;
    if (!input.matches('[data-file-field]')) return;

    const field = input.getAttribute('data-file-field');
    const file = input.files && input.files[0] ? input.files[0] : null;

    if (!file) return;

    if (!file.type || !file.type.startsWith('image/')) {
      alert('이미지 파일만 첨부할 수 있습니다.');
      input.value = '';
      return;
    }

    selectedFiles[field] = file;
    updateFilePreview(field, file.name);
  });

  document.addEventListener('click', function (event) {
    const clearButton = event.target.closest('[data-clear-file]');
    if (!clearButton) return;
    clearSelectedFile(clearButton.getAttribute('data-clear-file'));
  });
}

function updateFilePreview(field, fileName) {
  const row = document.getElementById(field + '_preview');
  const nameEl = document.querySelector(`[data-preview-name="${field}"]`);

  if (row && nameEl) {
    row.classList.add('active');
    nameEl.textContent = '첨부됨: ' + fileName;
  }
}

function clearSelectedFile(field) {
  delete selectedFiles[field];
  document.querySelectorAll(`[data-file-field="${field}"]`).forEach(function (input) {
    input.value = '';
  });

  const row = document.getElementById(field + '_preview');
  const nameEl = document.querySelector(`[data-preview-name="${field}"]`);

  if (row && nameEl) {
    row.classList.remove('active');
    nameEl.textContent = '';
  }
}

function bindExampleModal() {
  document.addEventListener('click', function (event) {
    const button = event.target.closest('[data-example-src]');
    if (!button) return;

    exampleImage.src = button.getAttribute('data-example-src');
    exampleModalTitle.textContent = button.getAttribute('data-example-title') || '첨부 예시';
    exampleCaption.textContent = button.getAttribute('data-example-caption') || '';
    exampleModal.hidden = false;
  });

  document.querySelectorAll('[data-close-modal]').forEach(function (el) {
    el.addEventListener('click', closeExampleModal);
  });

  document.addEventListener('keydown', function (event) {
    if (event.key === 'Escape') closeExampleModal();
  });
}

function closeExampleModal() {
  exampleModal.hidden = true;
  exampleImage.src = '';
}

function setupSignaturePad() {
  signatureContext = signaturePad.getContext('2d');
  resizeSignatureCanvas(false);

  signaturePad.addEventListener('pointerdown', startSignature);
  signaturePad.addEventListener('pointermove', drawSignature);
  signaturePad.addEventListener('pointerup', endSignature);
  signaturePad.addEventListener('pointercancel', endSignature);
  signaturePad.addEventListener('pointerleave', endSignature);

  clearSignatureBtn.addEventListener('click', clearSignature);
}

function resizeSignatureCanvas(keepExisting) {
  if (!signaturePad || !signatureContext) return;

  let oldDataUrl = '';
  if (keepExisting && hasSignature) {
    oldDataUrl = signaturePad.toDataURL('image/png');
  }

  const ratio = Math.max(window.devicePixelRatio || 1, 1);
  const rect = signaturePad.getBoundingClientRect();
  const width = Math.max(rect.width, 300);
  const height = Math.max(rect.height, 160);

  signaturePad.width = Math.round(width * ratio);
  signaturePad.height = Math.round(height * ratio);
  signatureContext.setTransform(ratio, 0, 0, ratio, 0, 0);
  signatureContext.lineWidth = 3;
  signatureContext.lineCap = 'round';
  signatureContext.lineJoin = 'round';
  signatureContext.strokeStyle = '#111827';

  if (oldDataUrl) {
    const img = new Image();
    img.onload = function () {
      signatureContext.drawImage(img, 0, 0, width, height);
    };
    img.src = oldDataUrl;
  }
}

function getCanvasPoint(event) {
  const rect = signaturePad.getBoundingClientRect();
  return {
    x: event.clientX - rect.left,
    y: event.clientY - rect.top
  };
}

function startSignature(event) {
  event.preventDefault();
  signaturePad.setPointerCapture(event.pointerId);
  signatureDrawing = true;
  lastSignaturePoint = getCanvasPoint(event);
  hasSignature = true;
  signatureWrap.classList.add('signed');
}

function drawSignature(event) {
  if (!signatureDrawing || !lastSignaturePoint) return;
  event.preventDefault();

  const point = getCanvasPoint(event);
  signatureContext.beginPath();
  signatureContext.moveTo(lastSignaturePoint.x, lastSignaturePoint.y);
  signatureContext.lineTo(point.x, point.y);
  signatureContext.stroke();
  lastSignaturePoint = point;
}

function endSignature(event) {
  if (!signatureDrawing) return;
  event.preventDefault();
  signatureDrawing = false;
  lastSignaturePoint = null;
}

function clearSignature() {
  const rect = signaturePad.getBoundingClientRect();
  signatureContext.clearRect(0, 0, rect.width, rect.height);
  hasSignature = false;
  signatureWrap.classList.remove('signed');
}

function getSignatureDataUrl() {
  const rect = signaturePad.getBoundingClientRect();
  const exportCanvas = document.createElement('canvas');
  exportCanvas.width = Math.round(rect.width);
  exportCanvas.height = Math.round(rect.height);
  const ctx = exportCanvas.getContext('2d');
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, exportCanvas.width, exportCanvas.height);
  ctx.drawImage(signaturePad, 0, 0, exportCanvas.width, exportCanvas.height);
  return exportCanvas.toDataURL('image/jpeg', 0.82);
}

async function buildPayload() {
  const submissionId = createSubmissionId();
  const formData = new FormData(form);

  const basic = {
    evaluationPeriod: formData.get('evaluationPeriod') || '',
    headquarter: formData.get('headquarter') || '',
    department: formData.get('department') || '',
    team: formData.get('team') || '',
    storeName: formData.get('storeName') || '',
    supervisorName: normalizeText(formData.get('supervisorName') || ''),
    employeeId: normalizeText(formData.get('employeeId') || '')
  };

  const items = EVALUATION_ITEMS.map(function (item, index) {
    return {
      no: index + 1,
      id: item.id,
      title: item.title,
      result: formData.get(`${item.id}_result`) || '상',
      reason: '',
      weight: item.weight,
      scoreHigh: item.scores.high,
      scoreMid: item.scores.mid,
      scoreLow: item.scores.low
    };
  });

  const scoreInfo = calculateScore(items);
  const attachments = await collectAttachments(submissionId);
  attachments.push({
    field: 'signature',
    label: '제출자 전자서명',
    hasFile: true,
    originalName: 'signature.jpg',
    fileName: `${submissionId}_signature.jpg`,
    mimeType: 'image/jpeg',
    size: getSignatureDataUrl().length,
    dataUrl: getSignatureDataUrl()
  });

  return {
    submissionId: submissionId,
    submittedAtClient: new Date().toISOString(),
    userAgent: navigator.userAgent,
    basic: basic,
    items: items,
    attachments: attachments,
    score: scoreInfo.score,
    rawScore: scoreInfo.rawScore,
    maxScore: scoreInfo.maxScore,
    highCount: scoreInfo.highCount,
    midCount: scoreInfo.midCount,
    lowCount: scoreInfo.lowCount
  };
}

async function collectAttachments(submissionId) {
  const attachments = [];

  for (const field of ALL_FILE_FIELDS) {
    const file = selectedFiles[field.name];

    if (!file) {
      attachments.push({
        field: field.name,
        label: field.label,
        hasFile: false
      });
      continue;
    }

    const processed = await processImageFile(file);

    attachments.push({
      field: field.name,
      label: field.label,
      hasFile: true,
      originalName: file.name,
      fileName: `${submissionId}_${field.name}_${sanitizeFileName(file.name)}`,
      mimeType: processed.mimeType,
      size: processed.size,
      dataUrl: processed.dataUrl
    });
  }

  return attachments;
}

async function processImageFile(file) {
  if (!file.type || !file.type.startsWith('image/')) {
    throw new Error(`${file.name} 파일은 이미지 파일만 첨부할 수 있습니다.`);
  }

  let dataUrl = await resizeImageToDataUrl(file, 900, 0.58);

  if (dataUrl.length > 240000) {
    dataUrl = await resizeImageToDataUrl(file, 750, 0.48);
  }

  if (dataUrl.length > 340000) {
    throw new Error(`${file.name} 사진 용량이 너무 큽니다. 문서 부분만 나오게 다시 촬영하거나 앨범에서 더 작은 사진을 선택해주세요.`);
  }

  return {
    dataUrl: dataUrl,
    mimeType: 'image/jpeg',
    size: dataUrl.length
  };
}

function resizeImageToDataUrl(file, maxSize, quality) {
  return new Promise(function (resolve, reject) {
    const reader = new FileReader();

    reader.onload = function () {
      const img = new Image();

      img.onload = function () {
        const ratio = Math.min(1, maxSize / Math.max(img.width, img.height));
        const width = Math.max(1, Math.round(img.width * ratio));
        const height = Math.max(1, Math.round(img.height * ratio));

        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;

        const ctx = canvas.getContext('2d');
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, width, height);
        ctx.drawImage(img, 0, 0, width, height);

        resolve(canvas.toDataURL('image/jpeg', quality));
      };

      img.onerror = function () {
        reject(new Error(`${file.name} 사진을 읽을 수 없습니다. JPG 또는 PNG로 다시 촬영해주세요.`));
      };

      img.src = reader.result;
    };

    reader.onerror = function () {
      reject(new Error(`${file.name} 파일을 읽을 수 없습니다.`));
    };

    reader.readAsDataURL(file);
  });
}

function calculateScore(items) {
  let highCount = 0;
  let midCount = 0;
  let lowCount = 0;
  let rawScore = 0;
  let maxScore = 0;

  const itemResultMap = {};
  (items || []).forEach(function (item) {
    if (item && item.id) itemResultMap[item.id] = item.result || '상';
  });

  EVALUATION_ITEMS.forEach(function (meta) {
    const result = itemResultMap[meta.id] || '상';
    const highScore = Number(meta.scores.high) || 0;
    const midScore = meta.scores.mid === null || meta.scores.mid === undefined || meta.scores.mid === ''
      ? null
      : Number(meta.scores.mid) || 0;

    maxScore += highScore;

    if (result === '상') {
      highCount += 1;
      rawScore += highScore;
    } else if (result === '중') {
      midCount += 1;
      rawScore += midScore === null ? 0 : midScore;
    } else if (result === '하') {
      lowCount += 1;
      rawScore += Number(meta.scores.low) || 0;
    }
  });

  const score = maxScore === 0 ? 0 : Math.round((rawScore / maxScore) * 1000) / 10;

  return { score, rawScore, maxScore, highCount, midCount, lowCount };
}

function formatScoreForDisplay(value) {
  const number = Number(value);
  if (!isFinite(number)) return value || '';
  return Number.isInteger(number) ? String(number) : String(Math.round(number * 10) / 10);
}
function postPayloadByHiddenForm(payload) {
  return new Promise(function (resolve, reject) {
    const iframeName = 'submitFrame_' + payload.submissionId;
    const iframe = document.createElement('iframe');
    iframe.name = iframeName;
    iframe.style.display = 'none';

    const postForm = document.createElement('form');
    postForm.method = 'POST';
    postForm.action = APPS_SCRIPT_URL;
    postForm.target = iframeName;
    postForm.style.display = 'none';

    const modeInput = document.createElement('input');
    modeInput.type = 'hidden';
    modeInput.name = 'mode';
    modeInput.value = 'submit';

    const payloadInput = document.createElement('input');
    payloadInput.type = 'hidden';
    payloadInput.name = 'payload';
    payloadInput.value = JSON.stringify(payload);

    postForm.appendChild(modeInput);
    postForm.appendChild(payloadInput);

    let submitted = false;
    const timer = setTimeout(function () {
      cleanup();
      reject(new Error('전송 시간이 초과되었습니다. 사진 용량을 줄이거나 다시 시도해주세요.'));
    }, 90000);

    iframe.onload = function () {
      if (!submitted) return;
      clearTimeout(timer);
      setTimeout(function () {
        cleanup();
        resolve();
      }, 500);
    };

    function cleanup() {
      if (postForm.parentNode) postForm.parentNode.removeChild(postForm);
      if (iframe.parentNode) iframe.parentNode.removeChild(iframe);
    }

    document.body.appendChild(iframe);
    document.body.appendChild(postForm);

    setTimeout(function () {
      submitted = true;
      postForm.submit();
    }, 0);
  });
}

function waitForSaveStatus(submissionId) {
  const started = Date.now();
  const timeoutMs = 100000;
  const intervalMs = 2200;

  return new Promise(function (resolve, reject) {
    function poll() {
      jsonpRequest({ mode: 'status', submissionId: submissionId }, 20000)
        .then(function (data) {
          if (data && data.found) {
            if (data.success) {
              resolve(data);
            } else {
              reject(new Error(data.message || '저장 실패'));
            }
            return;
          }

          if (Date.now() - started > timeoutMs) {
            reject(new Error('저장 완료 확인 시간이 초과되었습니다. DB 시트를 확인해주세요.'));
            return;
          }

          setTimeout(poll, intervalMs);
        })
        .catch(function () {
          if (Date.now() - started > timeoutMs) {
            reject(new Error('저장 상태 확인에 실패했습니다. 네트워크 상태를 확인해주세요.'));
            return;
          }
          setTimeout(poll, intervalMs);
        });
    }

    poll();
  });
}

function jsonpRequest(params, timeoutMs) {
  return new Promise(function (resolve, reject) {
    const callbackName = 'callback_' + Date.now() + '_' + Math.floor(Math.random() * 1000000);
    const searchParams = new URLSearchParams(params);
    searchParams.append('callback', callbackName);
    searchParams.append('_', Date.now());

    const script = document.createElement('script');
    script.src = APPS_SCRIPT_URL + '?' + searchParams.toString();

    const timer = setTimeout(function () {
      cleanup();
      reject(new Error('요청 시간이 초과되었습니다.'));
    }, timeoutMs || 20000);

    window[callbackName] = function (data) {
      cleanup();
      resolve(data);
    };

    script.onerror = function () {
      cleanup();
      reject(new Error('Apps Script 호출 실패'));
    };

    function cleanup() {
      clearTimeout(timer);
      delete window[callbackName];
      if (script.parentNode) script.parentNode.removeChild(script);
    }

    document.body.appendChild(script);
  });
}

function validateAppsScriptUrl(showMessage = true) {
  const ok = APPS_SCRIPT_URL && APPS_SCRIPT_URL.startsWith('https://script.google.com/macros/s/');
  if (!ok && showMessage) {
    setResult('error', 'script.js 파일의 APPS_SCRIPT_URL에 Apps Script 웹앱 URL을 입력해야 합니다.');
  }
  return ok;
}

function validateOrganizationLoaded() {
  if (!Object.keys(orgTree).length) {
    setResult('error', '조직도 정보를 불러오지 못했습니다. 새로고침 후 다시 시도해주세요.');
    return false;
  }
  return true;
}

function validateBasicRequired() {
  const requiredFields = [
    [headquarterSelect, '영업본부를 선택해주세요.'],
    [departmentSelect, '부서명을 선택해주세요.'],
    [teamSelect, '팀명을 선택해주세요.'],
    [storeSelect, '매장명을 선택해주세요.'],
    [form.elements.supervisorName, '관리감독자 성명을 입력해주세요.'],
    [form.elements.employeeId, '사번을 입력해주세요.']
  ];

  for (const [el, message] of requiredFields) {
    if (!el || !String(el.value || '').trim()) {
      setResult('error', message);
      el.focus();
      return false;
    }
  }

  return true;
}

function validateJudgementReasons() { return true; }
function validateRequiredAttachments() { return true; }
function validateAccidentAttachment() { return true; }

function validateSignature() {
  if (!hasSignature) {
    signatureWrap.scrollIntoView({ behavior: 'smooth', block: 'center' });
    setResult('error', '제출 전 서명란에 서명해주세요.');
    return false;
  }
  return true;
}

function resetFormAfterSuccess() {
  form.reset();
  selectedFiles = {};
  document.querySelectorAll('.preview-row').forEach(function (row) {
    row.classList.remove('active');
    const span = row.querySelector('span');
    if (span) span.textContent = '';
  });
  EVALUATION_ITEMS.forEach(function (item) {
    const good = form.querySelector(`input[name="${item.id}_result"][value="상"]`);
    if (good) good.checked = true;
    applyEvaluationItemState(item.id);
  });
  clearSignature();
  resetOrgSelectsAfterSubmit();
  applyAccidentFileRule();
}

function showLoading(show, message) {
  if (message) loadingText.textContent = message;
  loadingOverlay.hidden = !show;
}

function createSubmissionId() {
  const random = Math.random().toString(36).slice(2, 10);
  return 'MS-' + new Date().toISOString().replace(/[-:.TZ]/g, '').slice(0, 14) + '-' + random;
}

function sanitizeFileName(name) {
  return String(name || 'file').replace(/[\\/:*?"<>|]/g, '_').replace(/\s+/g, '_');
}

function normalizeText(value) {
  return String(value || '').trim().replace(/\s+/g, ' ');
}

function setResult(type, html) {
  resultMessage.className = 'result ' + type;
  resultMessage.innerHTML = html;
  if (type === 'error') {
    resultMessage.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }
}

function escapeHtml(value) {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function koreanSort(a, b) {
  return String(a).localeCompare(String(b), 'ko');
}

function debounce(fn, delay) {
  let timer;
  return function () {
    clearTimeout(timer);
    const args = arguments;
    timer = setTimeout(function () {
      fn.apply(null, args);
    }, delay);
  };
}
