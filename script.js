/**
 * 관리감독자 반기 업무수행 평가 시스템 - GitHub Pages용 script.js v18
 *
 * 핵심 구조
 * - 화면: GitHub Pages
 * - 조직도: Google Sheets '조직도' 시트 A:D를 Apps Script에서 불러옴
 * - 저장: Apps Script → Google Sheets DB
 * - 사진/서명: Google Drive 미사용, Google Sheets 내부 _FILE_INDEX / _FILE_CHUNKS 시트에 압축 저장
 * - 항목별 첨부사진은 추가 선택해도 기존 사진이 유지되며 최대 5장까지 등록 가능
 *
 * 사용 전 반드시 아래 APPS_SCRIPT_URL을 본인의 Apps Script 웹앱 URL로 변경하세요.
 */
const APPS_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbyiAuyW8GWHerxGDcxOkxYdInhurSQr_fg1K2XfgRwSHpTSrimCaPOjwnhSwg1FKcrX/exec';
const MAX_FILES_PER_FIELD = 5;

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
    exampleSrc: 'assets/examples/example_1.png'
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
    exampleSrc: 'assets/examples/example_2.png'
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
    exampleSrc: 'assets/examples/example_3.png'
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
    exampleSrc: 'assets/examples/example_4.png'
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
    exampleSrc: 'assets/examples/example_5.png'
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
    exampleSrc: 'assets/examples/example_6.png'
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
    exampleSrc: 'assets/examples/example_7.png',
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
    hint: '필요한 경우 사진을 여러 장 첨부할 수 있습니다. 최대 5장까지 가능합니다.',
    required: false,
    evidenceOnly: true,
    itemId: item.id
  };
});

const ALL_FILE_FIELDS = DOCUMENT_FILE_FIELDS.concat(EVIDENCE_FILE_FIELDS);

let orgTree = {};
let selectedFiles = {};
let hasSignature = false;

const pageRoot = document.getElementById('pageRoot');
const noticeCard = document.getElementById('noticeCard');
const form = document.getElementById('evaluationForm');
const submitBtn = document.getElementById('submitBtn');
const resultMessage = document.getElementById('resultMessage');
const evaluationItemsContainer = document.getElementById('evaluationItems');
const attachmentList = document.getElementById('attachmentList');
const basicInfoSection = document.getElementById('basicInfoSection');
const evaluationPage = document.getElementById('evaluationPage');
const startEvaluationBtn = document.getElementById('startEvaluationBtn');
const editBasicInfoBtn = document.getElementById('editBasicInfoBtn');
const selectedInfoText = document.getElementById('selectedInfoText');
const entryMessage = document.getElementById('entryMessage');

const orgLoadMessage = document.getElementById('orgLoadMessage');
const headquarterSelect = document.getElementById('headquarterSelect');
const departmentSelect = document.getElementById('departmentSelect');
const teamSelect = document.getElementById('teamSelect');
const storeSelect = document.getElementById('storeSelect');
const employeeIdInput = document.getElementById('employeeIdInput');
const employeeIdFull = document.getElementById('employeeIdFull');
const accidentOccurredSelect = null;

const signaturePad = document.getElementById('signaturePad');
const clearSignatureBtn = document.getElementById('clearSignatureBtn');
const signatureWrap = document.querySelector('.signature-pad-wrap');

const loadingOverlay = document.getElementById('loadingOverlay');
const loadingTitle = document.getElementById('loadingTitle');
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
  bindEmployeeIdInput();
  bindEntryPage();
  showEntryPage(false);
  ensureSubmitModal();
  setupSignaturePad();
  loadOrganizationTree();
});

window.addEventListener('resize', debounce(function () {
  resizeSignatureCanvas(true);
}, 250));

form.addEventListener('submit', async function (event) {
  event.preventDefault();

  clearResult();

  if (!validateAppsScriptUrl()) return;
  if (!validateOrganizationLoaded()) return;
  if (!validateBasicRequired()) return;
  if (!validateSignature()) return;

  updateEmployeeIdFull();
  const basicForConfirm = getBasicInfoFromForm();
  const confirmed = await confirmSubmissionDetails(basicForConfirm);
  if (!confirmed) return;

  showLoading(true, '동일 사번·성명·매장으로 이미 제출된 내역이 있는지 확인 중입니다.');
  submitBtn.disabled = true;
  submitBtn.textContent = '제출 확인 중...';

  try {
    const duplicate = await checkDuplicateSubmission(basicForConfirm);
    if (duplicate && duplicate.exists) {
      showLoading(false);
      await showSubmitModal({
        type: 'error',
        title: '이미 제출된 정보입니다',
        html: `동일한 <strong>사번·성명·매장명</strong>으로 이미 제출된 이력이 있습니다.<br><br>
          <div class="modal-info-box">
            <div><b>매장명</b><span>${escapeHtml(duplicate.storeName || basicForConfirm.storeName)}</span></div>
            <div><b>성명</b><span>${escapeHtml(duplicate.supervisorName || basicForConfirm.supervisorName)}</span></div>
            <div><b>사번</b><span>${escapeHtml(duplicate.employeeId || basicForConfirm.employeeId)}</span></div>
            ${duplicate.submittedAt ? `<div><b>제출일시</b><span>${escapeHtml(duplicate.submittedAt)}</span></div>` : ''}
          </div>
          <p class="modal-small-text">수정 또는 재제출이 필요한 경우 안전보건팀에 문의해주세요.</p>`,
        confirmText: '확인'
      });
      return;
    }

    showLoading(true, '사진을 압축하고 제출 자료를 준비 중입니다. 창을 닫지 말고 기다려주세요.');
    submitBtn.textContent = '제출 중입니다...';

    const payload = await buildPayload();

    showLoading(true, '자료를 전송 중입니다. 네트워크 상태에 따라 시간이 걸릴 수 있습니다.');
    await postPayloadByHiddenForm(payload);

    showLoading(true, '자료가 전송되었습니다. 저장 완료 여부를 확인 중입니다.');
    const status = await waitForSaveStatus(payload.submissionId);

    if (status && status.success) {
      showLoading(false);
      await showSubmitModal({
        type: 'success',
        title: '제출이 완료되었습니다',
        html: `<div class="modal-info-box">
            <div><b>매장명</b><span>${escapeHtml(payload.basic.storeName)}</span></div>
            <div><b>성명</b><span>${escapeHtml(payload.basic.supervisorName)}</span></div>
            <div><b>사번</b><span>${escapeHtml(payload.basic.employeeId)}</span></div>
          </div>
          <p class="modal-small-text">제출해주신 내용은 안전보건팀 DB와 대시보드에 자동 반영됩니다.</p>`,
        confirmText: '다른 매장 이어서 작성'
      });
      resetFormAfterSuccess();
    } else {
      throw new Error(status && status.message ? status.message : '저장 상태 확인 실패');
    }
  } catch (error) {
    console.error(error);
    showLoading(false);
    await showSubmitModal({
      type: 'error',
      title: '제출 중 오류가 발생했습니다',
      html: `${escapeHtml(error.message)}<p class="modal-small-text">계속 오류가 발생하면 화면을 캡처하여 안전보건팀에 문의해주세요.</p>`,
      confirmText: '확인'
    });
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
      <input class="file-input-hidden" id="${inputId}" type="file" accept="image/*" multiple data-file-field="${escapeHtml(field.name)}" />
      <div class="${actionClass}">
        <label class="photo-btn attach" for="${inputId}">📎 첨부</label>
        ${secondActionHtml}
      </div>
      <p class="photo-add-guide">추가로 첨부해도 기존 사진은 유지됩니다. 삭제 버튼을 누르면 해당 항목 사진이 모두 삭제됩니다.</p>
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

function bindEntryPage() {
  if (startEvaluationBtn) {
    startEvaluationBtn.addEventListener('click', function () {
      clearResult();
      if (!validateAppsScriptUrl()) return;
      if (!validateOrganizationLoaded()) return;
      if (!validateBasicRequired()) return;
      updateEmployeeIdFull();
      updateSelectedInfoSummary();
      showEvaluationPage();
    });
  }

  if (editBasicInfoBtn) {
    editBasicInfoBtn.addEventListener('click', function () {
      showEntryPage(true);
    });
  }
}

function showEvaluationPage() {
  if (pageRoot) pageRoot.classList.add('evaluation-mode');
  if (noticeCard) noticeCard.hidden = true;
  if (basicInfoSection) basicInfoSection.hidden = true;
  if (evaluationPage) evaluationPage.hidden = false;
  updateSelectedInfoSummary();
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function showEntryPage(scrollTop) {
  if (pageRoot) pageRoot.classList.remove('evaluation-mode');
  if (noticeCard) noticeCard.hidden = false;
  if (basicInfoSection) basicInfoSection.hidden = false;
  if (evaluationPage) evaluationPage.hidden = true;
  if (scrollTop) {
    window.scrollTo({ top: 0, behavior: 'smooth' });
    setTimeout(function () {
      if (headquarterSelect && !headquarterSelect.disabled) headquarterSelect.focus();
    }, 400);
  }
}

function updateSelectedInfoSummary() {
  if (!selectedInfoText) return;
  const basic = getBasicInfoFromForm();
  selectedInfoText.textContent = [basic.headquarter, basic.department, basic.team, basic.storeName, basic.supervisorName, basic.employeeId]
    .filter(Boolean)
    .join(' · ') || '기본정보를 입력해주세요.';
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
    showLoading(false);
    return;
  }

  setOrgMessage('pending', '조직도 정보를 불러오는 중입니다...');
  showLoading(true, '영업본부·부서·팀·매장 정보를 불러오는 중입니다. 잠시만 기다려주세요.', '매장정보를 불러오는 중입니다');

  jsonpRequest({ mode: 'org' }, 30000)
    .then(function (data) {
      if (!data || !data.success) {
        throw new Error(data && data.message ? data.message : '조직도 불러오기 실패');
      }

      orgTree = data.tree || {};
      populateHeadquarters();
      setOrgMessage('success', `조직도 정보를 불러왔습니다. 총 ${data.count || 0}개 매장 기준입니다.`);
      showLoading(false);
    })
    .catch(function (error) {
      console.error(error);
      setOrgMessage('error', '조직도 정보를 불러오지 못했습니다. 조직도 시트명과 Apps Script 배포 권한을 확인해주세요.');
      resetSelect(headquarterSelect, '조직도 불러오기 실패', true);
      resetSelect(departmentSelect, '영업본부를 먼저 선택해주세요', true);
      resetSelect(teamSelect, '부서명을 먼저 선택해주세요', true);
      resetSelect(storeSelect, '팀명을 먼저 선택해주세요', true);
      showLoading(false);
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
    const files = Array.from(input.files || []);

    if (!files.length) return;

    const invalid = files.find(function (file) {
      return !file.type || !file.type.startsWith('image/');
    });

    if (invalid) {
      alert('이미지 파일만 첨부할 수 있습니다.');
      input.value = '';
      return;
    }

    const existingFiles = Array.isArray(selectedFiles[field]) ? selectedFiles[field] : [];
    const mergedFiles = existingFiles.concat(files);

    if (mergedFiles.length > MAX_FILES_PER_FIELD) {
      alert('한 항목당 최대 ' + MAX_FILES_PER_FIELD + '장까지 첨부할 수 있습니다. 현재 ' + existingFiles.length + '장이 첨부되어 있습니다.');
      input.value = '';
      return;
    }

    selectedFiles[field] = mergedFiles;
    updateFilePreview(field, mergedFiles);
    input.value = '';
  });

  document.addEventListener('click', function (event) {
    const clearButton = event.target.closest('[data-clear-file]');
    if (!clearButton) return;
    clearSelectedFile(clearButton.getAttribute('data-clear-file'));
  });
}

function updateFilePreview(field, files) {
  const row = document.getElementById(field + '_preview');
  const nameEl = document.querySelector(`[data-preview-name="${field}"]`);
  const fileList = Array.isArray(files) ? files : (files ? [files] : []);

  if (row && nameEl) {
    row.classList.add('active');
    if (fileList.length === 1) {
      nameEl.textContent = '첨부됨: 1장 · ' + fileList[0].name;
    } else {
      nameEl.textContent = '첨부됨: 총 ' + fileList.length + '장';
    }
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

function getBasicInfoFromForm() {
  const formData = new FormData(form);
  return {
    evaluationPeriod: formData.get('evaluationPeriod') || '',
    headquarter: formData.get('headquarter') || '',
    department: formData.get('department') || '',
    team: formData.get('team') || '',
    storeName: formData.get('storeName') || '',
    supervisorName: normalizeText(formData.get('supervisorName') || ''),
    employeeId: getFullEmployeeId()
  };
}

async function confirmSubmissionDetails(basic) {
  return showSubmitModal({
    type: 'confirm',
    title: '제출 정보 확인',
    html: `아래 정보로 제출됩니다.<br>사번·성명·매장명이 동일한 제출 건이 있으면 중복 제출이 차단됩니다.<br><br>
      <div class="modal-info-box">
        <div><b>영업본부</b><span>${escapeHtml(basic.headquarter)}</span></div>
        <div><b>부서명</b><span>${escapeHtml(basic.department)}</span></div>
        <div><b>팀명</b><span>${escapeHtml(basic.team)}</span></div>
        <div><b>매장명</b><span>${escapeHtml(basic.storeName)}</span></div>
        <div><b>성명</b><span>${escapeHtml(basic.supervisorName)}</span></div>
        <div><b>사번</b><span>${escapeHtml(basic.employeeId)}</span></div>
      </div>
      <p class="modal-small-text">정보가 다르면 취소 후 수정해주세요.</p>`,
    confirmText: '확인 후 제출',
    cancelText: '수정하기'
  });
}

async function checkDuplicateSubmission(basic) {
  const data = await jsonpRequest({
    mode: 'duplicate',
    employeeId: basic.employeeId,
    supervisorName: basic.supervisorName,
    storeName: basic.storeName
  }, 20000);

  if (!data || data.success === false) {
    throw new Error(data && data.message ? data.message : '중복 제출 확인에 실패했습니다.');
  }

  return data;
}

function ensureSubmitModal() {
  if (document.getElementById('submitModal')) return;

  const modal = document.createElement('div');
  modal.id = 'submitModal';
  modal.className = 'submit-modal';
  modal.hidden = true;
  modal.innerHTML = `
    <div class="submit-modal-backdrop" data-submit-modal-cancel></div>
    <div class="submit-modal-panel" role="dialog" aria-modal="true" aria-labelledby="submitModalTitle">
      <div class="submit-modal-icon" id="submitModalIcon">✓</div>
      <h2 id="submitModalTitle"></h2>
      <div id="submitModalBody" class="submit-modal-body"></div>
      <div class="submit-modal-actions">
        <button type="button" id="submitModalCancel" class="submit-modal-btn secondary">취소</button>
        <button type="button" id="submitModalConfirm" class="submit-modal-btn primary">확인</button>
      </div>
    </div>
  `;
  document.body.appendChild(modal);
}

function showSubmitModal(options) {
  ensureSubmitModal();

  const modal = document.getElementById('submitModal');
  const panel = modal.querySelector('.submit-modal-panel');
  const icon = document.getElementById('submitModalIcon');
  const title = document.getElementById('submitModalTitle');
  const body = document.getElementById('submitModalBody');
  const confirmBtn = document.getElementById('submitModalConfirm');
  const cancelBtn = document.getElementById('submitModalCancel');
  const backdrop = modal.querySelector('[data-submit-modal-cancel]');

  const type = options.type || 'confirm';
  panel.className = 'submit-modal-panel ' + type;
  icon.textContent = type === 'success' ? '✓' : (type === 'error' ? '!' : '?');
  title.textContent = options.title || '확인';
  body.innerHTML = options.html || '';
  confirmBtn.textContent = options.confirmText || '확인';

  const hasCancel = Boolean(options.cancelText);
  cancelBtn.hidden = !hasCancel;
  cancelBtn.textContent = options.cancelText || '취소';

  modal.hidden = false;
  document.body.classList.add('modal-open');
  confirmBtn.focus();

  return new Promise(function (resolve) {
    function close(value) {
      modal.hidden = true;
      document.body.classList.remove('modal-open');
      confirmBtn.removeEventListener('click', onConfirm);
      cancelBtn.removeEventListener('click', onCancel);
      backdrop.removeEventListener('click', onCancel);
      document.removeEventListener('keydown', onKeydown);
      resolve(value);
    }

    function onConfirm() { close(true); }
    function onCancel() { close(false); }
    function onKeydown(event) {
      if (event.key === 'Escape') close(false);
    }

    confirmBtn.addEventListener('click', onConfirm);
    cancelBtn.addEventListener('click', onCancel);
    backdrop.addEventListener('click', onCancel);
    document.addEventListener('keydown', onKeydown);
  });
}


async function buildPayload() {
  const submissionId = createSubmissionId();
  const formData = new FormData(form);
  const basic = getBasicInfoFromForm();

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
    const raw = selectedFiles[field.name];
    const files = Array.isArray(raw) ? raw : (raw ? [raw] : []);

    if (!files.length) {
      attachments.push({
        field: field.name,
        label: field.label,
        hasFile: false
      });
      continue;
    }

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const processed = await processImageFile(file);
      const suffix = files.length > 1 ? '_' + (i + 1) : '';

      attachments.push({
        field: field.name,
        label: field.label + (files.length > 1 ? ' ' + (i + 1) + '/' + files.length : ''),
        hasFile: true,
        fileIndex: i + 1,
        fileCount: files.length,
        originalName: file.name,
        fileName: `${submissionId}_${field.name}${suffix}_${sanitizeFileName(file.name)}`,
        mimeType: processed.mimeType,
        size: processed.size,
        dataUrl: processed.dataUrl
      });
    }
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
    [form.elements.supervisorName, '관리감독자 성명을 입력해주세요.']
  ];

  for (const [el, message] of requiredFields) {
    if (!el || !String(el.value || '').trim()) {
      setResult('error', message);
      el.focus();
      return false;
    }
  }

  if (!getEmployeeIdDigits()) {
    setResult('error', '사번 숫자를 입력해주세요. AD는 자동으로 붙습니다.');
    if (employeeIdInput) employeeIdInput.focus();
    return false;
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
  clearResult();
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
  if (employeeIdFull) employeeIdFull.value = '';
  resetOrgSelectsAfterSubmit();
  applyAccidentFileRule();
  showEntryPage(true);
}

function showLoading(show, message, title) {
  if (title && loadingTitle) loadingTitle.textContent = title;
  if (!title && loadingTitle && show) loadingTitle.textContent = '제출 중입니다';
  if (message) loadingText.textContent = message;
  loadingOverlay.hidden = !show;
}


function bindEmployeeIdInput() {
  if (!employeeIdInput) return;

  employeeIdInput.addEventListener('input', function () {
    employeeIdInput.value = getEmployeeIdDigits();
    updateEmployeeIdFull();
  });

  employeeIdInput.addEventListener('blur', updateEmployeeIdFull);
  updateEmployeeIdFull();
}

function getEmployeeIdDigits() {
  if (!employeeIdInput) return '';
  return String(employeeIdInput.value || '').replace(/\D/g, '');
}

function getFullEmployeeId() {
  const digits = getEmployeeIdDigits();
  return digits ? 'AD' + digits : '';
}

function updateEmployeeIdFull() {
  if (employeeIdFull) employeeIdFull.value = getFullEmployeeId();
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
  if (resultMessage) {
    resultMessage.className = 'result ' + type;
    resultMessage.innerHTML = html;
  }
  if (entryMessage) {
    entryMessage.className = 'result ' + type;
    entryMessage.innerHTML = html;
  }
  if (type === 'error') {
    const target = evaluationPage && !evaluationPage.hidden ? resultMessage : entryMessage;
    if (target) target.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }
}

function clearResult() {
  if (resultMessage) {
    resultMessage.className = 'result';
    resultMessage.innerHTML = '';
  }
  if (entryMessage) {
    entryMessage.className = 'result';
    entryMessage.innerHTML = '';
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
