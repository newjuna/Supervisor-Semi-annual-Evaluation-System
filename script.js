/**
 * 관리감독자 통합 관리 시스템 - GitHub Pages용 script.js v28
 *
 * 핵심 구조
 * - 화면: GitHub Pages
 * - 조직도: Google Sheets '조직도' 시트 A:D를 Apps Script에서 불러옴
 * - 저장: Apps Script → Google Sheets DB
 * - 사진/서명: Google Drive 미사용, Google Sheets 내부 _FILE_INDEX / _FILE_CHUNKS 시트에 압축 저장
 * - 항목별 첨부사진은 추가 선택해도 기존 사진이 유지되며, 제출 전 자동 압축 저장
 *
 * 사용 전 반드시 아래 APPS_SCRIPT_URL을 본인의 Apps Script 웹앱 URL로 변경하세요.
 */
const APPS_SCRIPT_URL = '여기에_Apps_Script_웹앱_URL을_붙여넣으세요';
const IMAGE_COMPRESSION_CONFIG = {
  targetDataUrlLength: 260000,
  maxDataUrlLength: 360000,
  steps: [
    { maxSize: 1280, quality: 0.72 },
    { maxSize: 1100, quality: 0.64 },
    { maxSize: 900, quality: 0.56 },
    { maxSize: 750, quality: 0.48 },
    { maxSize: 640, quality: 0.42 }
  ]
};

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
      label: '📘 가이드'
    }
  }
];
const DOCUMENT_FILE_FIELDS = [];
const EVIDENCE_FILE_FIELDS = EVALUATION_ITEMS.map(function (item) {
  return {
    name: 'evidence_' + item.id,
    label: '판단 증빙사진 - ' + item.title,
    hint: '필요한 경우 사진을 여러 장 첨부할 수 있습니다. 제출 시 자동으로 압축 저장됩니다.',
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
  const actionClass = hasExample && hasGuide
    ? 'photo-actions three-actions'
    : (hasExample || hasGuide ? 'photo-actions with-example' : 'photo-actions no-example');
  const exampleActionHtml = hasExample
    ? `<button type="button" class="example-btn" data-example-src="${escapeHtml(field.exampleSrc)}" data-example-title="${escapeHtml(field.label)}" data-example-caption="${escapeHtml(field.hint)}">📒 예시</button>`
    : '';
  const guideActionHtml = hasGuide
    ? `<a class="example-btn guide-view-btn" href="${escapeHtml(field.guide.href)}" target="_blank" rel="noopener">${escapeHtml(field.guide.label)}</a>`
    : '';

  return `
    <div class="photo-picker" data-file-picker="${escapeHtml(field.name)}">
      <input class="file-input-hidden" id="${inputId}" type="file" accept="image/*" multiple data-file-field="${escapeHtml(field.name)}" />
      <div class="${actionClass}">
        <label class="photo-btn attach" for="${inputId}">📎 첨부</label>
        ${exampleActionHtml}
        ${guideActionHtml}
      </div>
      <p class="photo-add-guide">추가로 첨부해도 기존 사진은 유지됩니다. 제출 시 사진은 자동 압축되어 저장됩니다.</p>
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
    startEvaluationBtn.addEventListener('click', async function () {
      clearResult();
      if (!validateAppsScriptUrl()) return;
      if (!validateOrganizationLoaded()) return;
      if (!validateBasicRequired()) return;
      updateEmployeeIdFull();

      const basic = getBasicInfoFromForm();
      startEvaluationBtn.disabled = true;
      showLoading(true, '관리감독자 임명 정보를 확인 중입니다.');

      try {
        const appointment = await checkAppointmentBeforeEvaluation(basic);
        showLoading(false);

        if (!appointment || !appointment.allowed) {
          const ap = appointment && appointment.appointment ? appointment.appointment : {};
          await showSubmitModal({
            type: 'error',
            title: '임명 정보 확인 필요',
            html: `${escapeHtml((appointment && appointment.message) || '해당 매장의 관리감독자 임명 정보가 확인되지 않습니다.')}<br><br>
              ${ap && ap.supervisorName ? `<div class="modal-info-box">
                <div><b>현재 임명자</b><span>${escapeHtml(ap.supervisorName || '')}</span></div>
                <div><b>사번</b><span>${escapeHtml(ap.employeeId || '')}</span></div>
                <div><b>상태</b><span>${escapeHtml(ap.status || '')}</span></div>
              </div>` : ''}
              <p class="modal-small-text">반기평가는 관리감독자 임명 등록 후 진행할 수 있습니다.</p>`,
            confirmText: '확인'
          });
          return;
        }

        updateSelectedInfoSummary();
        showEvaluationPage();
      } catch (error) {
        showLoading(false);
        await showSubmitModal({
          type: 'error',
          title: '임명 정보 확인 실패',
          html: `${escapeHtml(error.message)}<p class="modal-small-text">계속 오류가 발생하면 안전보건팀에 문의해주세요.</p>`,
          confirmText: '확인'
        });
      } finally {
        startEvaluationBtn.disabled = false;
      }
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
    html: `아래 정보로 제출됩니다.<br>임명된 관리감독자 정보 확인 후 제출됩니다. 동일 매장은 1회만 제출할 수 있습니다.<br><br>
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


async function checkAppointmentBeforeEvaluation(basic) {
  const data = await jsonpRequest({
    mode: 'appointmentLookup',
    employeeId: basic.employeeId,
    supervisorName: basic.supervisorName,
    storeName: basic.storeName
  }, 20000);

  if (!data || data.success === false) {
    throw new Error(data && data.message ? data.message : '관리감독자 임명 정보 확인에 실패했습니다.');
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
        originalSize: processed.originalSize || file.size || 0,
        compressed: !!processed.compressed,
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

  let bestDataUrl = null;
  const steps = IMAGE_COMPRESSION_CONFIG.steps || [];

  for (let i = 0; i < steps.length; i++) {
    const step = steps[i];
    const dataUrl = await resizeImageToDataUrl(file, step.maxSize, step.quality);
    bestDataUrl = dataUrl;

    if (dataUrl.length <= IMAGE_COMPRESSION_CONFIG.targetDataUrlLength) {
      break;
    }
  }

  if (!bestDataUrl) {
    throw new Error(`${file.name} 사진을 압축할 수 없습니다. JPG 또는 PNG로 다시 촬영해주세요.`);
  }

  if (bestDataUrl.length > IMAGE_COMPRESSION_CONFIG.maxDataUrlLength) {
    throw new Error(`${file.name} 사진 용량이 너무 큽니다. 문서 부분만 나오게 다시 촬영하거나 앨범에서 더 작은 사진을 선택해주세요.`);
  }

  return {
    dataUrl: bestDataUrl,
    mimeType: 'image/jpeg',
    size: bestDataUrl.length,
    originalSize: file.size || 0,
    compressed: true
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

/* ==============================
   v19 통합 시스템 추가 스크립트
   - 반기평가 기능은 기존 로직 유지
   - 관리감독자 임명/변경 기능 추가
   ============================== */
let appointmentStoreSeq = 0;

window.addEventListener('DOMContentLoaded', function () {
  initV19ModuleSwitch();
  initAppointmentModule();
});

function initV19ModuleSwitch() {
  const evaluationModule = document.getElementById('evaluationModule');
  const appointmentModule = document.getElementById('appointmentModule');
  const showEvaluationBtn = document.getElementById('showEvaluationModuleBtn');
  const showAppointmentBtn = document.getElementById('showAppointmentModuleBtn');
  if (!evaluationModule || !appointmentModule || !showEvaluationBtn || !showAppointmentBtn) return;

  showEvaluationBtn.addEventListener('click', function () {
    evaluationModule.hidden = false;
    appointmentModule.hidden = true;
    showEvaluationBtn.classList.add('active');
    showAppointmentBtn.classList.remove('active');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  });

  showAppointmentBtn.addEventListener('click', function () {
    evaluationModule.hidden = true;
    appointmentModule.hidden = false;
    showAppointmentBtn.classList.add('active');
    showEvaluationBtn.classList.remove('active');
    ensureAppointmentStoreRow();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  });
}

function initAppointmentModule() {
  const formEl = document.getElementById('appointmentForm');
  const addBtn = document.getElementById('addAppointmentStoreBtn');
  const empInput = document.getElementById('appointmentEmployeeIdInput');
  const newBtn = document.getElementById('newAppointmentBtn');

  if (addBtn) addBtn.addEventListener('click', addAppointmentStoreRow);
  if (newBtn) newBtn.addEventListener('click', resetAppointmentForm);
  if (empInput) {
    empInput.addEventListener('input', function () {
      empInput.value = String(empInput.value || '').replace(/\D/g, '');
      const full = document.getElementById('appointmentEmployeeIdFull');
      if (full) full.value = empInput.value ? 'AD' + empInput.value : '';
    });
  }
  if (formEl) formEl.addEventListener('submit', handleAppointmentSubmit);
}

function ensureAppointmentStoreRow() {
  const container = document.getElementById('appointmentStoreList');
  if (container && !container.children.length) addAppointmentStoreRow();
}

function addAppointmentStoreRow() {
  const container = document.getElementById('appointmentStoreList');
  if (!container) return;
  appointmentStoreSeq += 1;
  const id = 'appointmentStore_' + appointmentStoreSeq;
  const card = document.createElement('div');
  card.className = 'appointment-store-card';
  card.dataset.appointmentStoreRow = id;
  card.innerHTML = `
    <div class="appointment-store-head">
      <strong>임명 매장 ${container.children.length + 1}</strong>
      ${container.children.length > 0 ? '<button type="button" class="remove-appointment-store">삭제</button>' : ''}
    </div>
    <div class="appointment-store-grid">
      <label>매장구분 <span class="required-mark">*</span><select data-appt="headquarter"><option value="">매장구분 선택</option></select></label>
      <label>부서명 <span class="required-mark">*</span><select data-appt="department" disabled><option value="">매장구분을 먼저 선택</option></select></label>
      <label>팀명 <span class="required-mark">*</span><select data-appt="team" disabled><option value="">부서명을 먼저 선택</option></select></label>
      <label>매장명 <span class="required-mark">*</span><select data-appt="storeName" disabled><option value="">팀명을 먼저 선택</option></select></label>
    </div>`;
  container.appendChild(card);

  const hq = card.querySelector('[data-appt="headquarter"]');
  const dept = card.querySelector('[data-appt="department"]');
  const team = card.querySelector('[data-appt="team"]');
  const store = card.querySelector('[data-appt="storeName"]');

  fillAppointmentSelect(hq, Object.keys(orgTree || {}).sort(koreanSort), '매장구분 선택', !Object.keys(orgTree || {}).length);
  hq.addEventListener('change', function () {
    const departments = hq.value && orgTree[hq.value] ? Object.keys(orgTree[hq.value]).sort(koreanSort) : [];
    fillAppointmentSelect(dept, departments, '부서명 선택', departments.length === 0);
    fillAppointmentSelect(team, [], '부서명을 먼저 선택', true);
    fillAppointmentSelect(store, [], '팀명을 먼저 선택', true);
  });
  dept.addEventListener('change', function () {
    const teams = hq.value && dept.value && orgTree[hq.value] && orgTree[hq.value][dept.value]
      ? Object.keys(orgTree[hq.value][dept.value]).sort(koreanSort)
      : [];
    fillAppointmentSelect(team, teams, '팀명 선택', teams.length === 0);
    fillAppointmentSelect(store, [], '팀명을 먼저 선택', true);
  });
  team.addEventListener('change', function () {
    const stores = hq.value && dept.value && team.value && orgTree[hq.value] && orgTree[hq.value][dept.value] && orgTree[hq.value][dept.value][team.value]
      ? orgTree[hq.value][dept.value][team.value].slice().sort(koreanSort)
      : [];
    fillAppointmentSelect(store, stores, '매장명 선택', stores.length === 0);
  });

  const removeBtn = card.querySelector('.remove-appointment-store');
  if (removeBtn) removeBtn.addEventListener('click', function () {
    card.remove();
    renumberAppointmentStoreRows();
  });
}

function refreshAppointmentRows() {
  document.querySelectorAll('[data-appointment-store-row]').forEach(function (row) {
    const hq = row.querySelector('[data-appt="headquarter"]');
    if (!hq || hq.value) return;
    fillAppointmentSelect(hq, Object.keys(orgTree || {}).sort(koreanSort), '매장구분 선택', !Object.keys(orgTree || {}).length);
  });
}

function renumberAppointmentStoreRows() {
  document.querySelectorAll('.appointment-store-card').forEach(function (row, index) {
    const title = row.querySelector('.appointment-store-head strong');
    if (title) title.textContent = '임명 매장 ' + (index + 1);
  });
}

function fillAppointmentSelect(select, options, placeholder, disabled) {
  if (!select) return;
  select.innerHTML = '';
  const first = document.createElement('option');
  first.value = '';
  first.textContent = placeholder;
  select.appendChild(first);
  (options || []).forEach(function (value) {
    const opt = document.createElement('option');
    opt.value = value;
    opt.textContent = value;
    select.appendChild(opt);
  });
  select.disabled = !!disabled;
}

async function handleAppointmentSubmit(event) {
  event.preventDefault();
  const resultEl = document.getElementById('appointmentResultMessage');
  if (resultEl) resultEl.textContent = '';

  if (!validateAppsScriptUrl()) return;
  const name = normalizeText(document.getElementById('appointmentName').value || '');
  const digits = String(document.getElementById('appointmentEmployeeIdInput').value || '').replace(/\D/g, '');
  const employeeId = digits ? 'AD' + digits : '';
  if (!name) return setAppointmentResult('error', '관리감독자 성명을 입력해주세요.');
  if (!employeeId) return setAppointmentResult('error', '사번 숫자를 입력해주세요. AD는 자동으로 붙습니다.');

  const stores = collectAppointmentStores();
  if (!stores.length) return setAppointmentResult('error', '임명할 매장을 1개 이상 선택해주세요.');

  const confirmed = await showSubmitModal({
    type: 'confirm',
    title: '임명 정보 확인',
    html: `<div class="modal-info-box">
      <div><b>성명</b><span>${escapeHtml(name)}</span></div>
      <div><b>사번</b><span>${escapeHtml(employeeId)}</span></div>
      <div><b>매장 수</b><span>${stores.length}개</span></div>
      <div><b>매장</b><span>${escapeHtml(stores.map(s => s.storeName).join(', '))}</span></div>
    </div><p class="modal-small-text">기존 선임자가 있는 매장은 해임 처리 후 신규 선임됩니다.</p>`,
    confirmText: '임명장 생성',
    cancelText: '수정하기'
  });
  if (!confirmed) return;

  showLoading(true, '기존 선임 내역을 확인하고 있습니다.', '임명장 생성 준비 중');
  try {
    const conflict = await jsonpRequest({
      mode: 'appointmentConflicts',
      employeeId,
      supervisorName: name,
      storeNames: stores.map(s => s.storeName).join('|')
    }, 30000);
    if (conflict && conflict.success && (conflict.personConflict || (conflict.storeConflicts || []).length)) {
      const lines = [];
      if (conflict.personConflict) lines.push(`동일 사번 기존 선임: ${conflict.personConflict.storeName || ''}`);
      (conflict.storeConflicts || []).slice(0, 5).forEach(c => lines.push(`${c.storeName}: ${c.supervisorName || ''} ${c.employeeId || ''}`));
      const ok = await showSubmitModal({
        type: 'confirm',
        title: '기존 선임 내역 확인',
        html: `기존 선임 내역이 확인되었습니다.<br>계속 진행하면 기존 내역은 해임 처리됩니다.<br><br><div class="modal-info-box"><div><b>확인내용</b><span>${escapeHtml(lines.join(' / '))}</span></div></div>`,
        confirmText: '계속 진행',
        cancelText: '취소'
      });
      if (!ok) { showLoading(false); return; }
    }

    const submissionId = createAppointmentSubmissionId();
    const payload = { type: 'appointment', submissionId, person: { name, employeeId }, stores, userAgent: navigator.userAgent || '' };
    showLoading(true, '임명장 PDF를 생성하고 있습니다. 창을 닫지 말고 기다려주세요.', '임명장 생성 중');
    await postPayloadByHiddenForm(payload);
    const status = await waitForAppointmentStatus(submissionId);
    showLoading(false);
    if (status && status.success) displayAppointmentResults(status.results || []);
  } catch (err) {
    showLoading(false);
    setAppointmentResult('error', err.message || String(err));
  }
}

function collectAppointmentStores() {
  const rows = [];
  document.querySelectorAll('.appointment-store-card').forEach(function (row) {
    const headquarter = row.querySelector('[data-appt="headquarter"]').value;
    const department = row.querySelector('[data-appt="department"]').value;
    const team = row.querySelector('[data-appt="team"]').value;
    const storeName = row.querySelector('[data-appt="storeName"]').value;
    if (headquarter && department && team && storeName) rows.push({ headquarter, department, team, storeName });
  });
  return rows;
}

function setAppointmentResult(type, msg) {
  const resultEl = document.getElementById('appointmentResultMessage');
  if (!resultEl) return;
  resultEl.className = 'result ' + type;
  resultEl.textContent = msg;
}

function createAppointmentSubmissionId() {
  const random = Math.random().toString(36).slice(2, 10);
  return 'AP-' + new Date().toISOString().replace(/[-:.TZ]/g, '').slice(0, 14) + '-' + random;
}

function waitForAppointmentStatus(submissionId) {
  const started = Date.now();
  const timeoutMs = 120000;
  const intervalMs = 2200;
  return new Promise(function (resolve, reject) {
    function poll() {
      jsonpRequest({ mode: 'appointmentStatus', submissionId }, 25000)
        .then(function (data) {
          if (data && data.found) {
            if (data.success) resolve(data);
            else reject(new Error(data.message || '임명장 생성 실패'));
            return;
          }
          if (Date.now() - started > timeoutMs) return reject(new Error('임명장 생성 확인 시간이 초과되었습니다. designation_log를 확인해주세요.'));
          setTimeout(poll, intervalMs);
        })
        .catch(function () {
          if (Date.now() - started > timeoutMs) return reject(new Error('임명장 생성 상태 확인에 실패했습니다.'));
          setTimeout(poll, intervalMs);
        });
    }
    poll();
  });
}

function displayAppointmentResults(results) {
  const formEl = document.getElementById('appointmentForm');
  const success = document.getElementById('appointmentSuccessArea');
  const list = document.getElementById('appointmentDownloadList');
  if (formEl) formEl.hidden = true;
  if (success) success.hidden = false;
  if (list) {
    list.innerHTML = '';
    (results || []).forEach(function (r) {
      const item = document.createElement('div');
      item.className = 'download-item';
      item.innerHTML = `<span>📍 ${escapeHtml(r.storeName || '')}</span><a class="btn-small-dl" href="${escapeHtml(r.viewUrl || '#')}" target="_blank" rel="noopener">PDF 열기</a>`;
      list.appendChild(item);
    });
  }
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function resetAppointmentForm() {
  const formEl = document.getElementById('appointmentForm');
  const success = document.getElementById('appointmentSuccessArea');
  const container = document.getElementById('appointmentStoreList');
  if (formEl) { formEl.reset(); formEl.hidden = false; }
  if (success) success.hidden = true;
  if (container) container.innerHTML = '';
  const full = document.getElementById('appointmentEmployeeIdFull');
  if (full) full.value = '';
  appointmentStoreSeq = 0;
  addAppointmentStoreRow();
  setAppointmentResult('', '');
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

// v19: 매장리스트 기준 조직도 로딩 + 임명 매장 선택창 동시 갱신
function loadOrganizationTree() {
  if (!validateAppsScriptUrl(false)) {
    setOrgMessage('error', 'Apps Script URL을 먼저 script.js에 입력해야 매장정보를 불러올 수 있습니다.');
    showLoading(false);
    return;
  }
  setOrgMessage('pending', '매장정보를 불러오는 중입니다...');
  showLoading(true, '직영점·유통점·유통CAO 매장정보를 불러오는 중입니다. 잠시만 기다려주세요.', '매장정보를 불러오는 중입니다');
  jsonpRequest({ mode: 'org' }, 30000)
    .then(function (data) {
      if (!data || !data.success) throw new Error(data && data.message ? data.message : '매장정보 불러오기 실패');
      orgTree = data.tree || {};
      populateHeadquarters();
      refreshAppointmentRows();
      setOrgMessage('success', `매장정보를 불러왔습니다. 총 ${data.count || 0}개 매장 기준입니다.`);
      showLoading(false);
    })
    .catch(function (error) {
      console.error(error);
      setOrgMessage('error', '매장정보를 불러오지 못했습니다. 직영점/유통점/유통CAO 시트와 Apps Script 배포 권한을 확인해주세요.');
      resetSelect(headquarterSelect, '매장정보 불러오기 실패', true);
      resetSelect(departmentSelect, '매장구분을 먼저 선택해주세요', true);
      resetSelect(teamSelect, '부서명을 먼저 선택해주세요', true);
      resetSelect(storeSelect, '팀명을 먼저 선택해주세요', true);
      showLoading(false);
    });
}

function populateHeadquarters() {
  const headquarters = Object.keys(orgTree).sort(koreanSort);
  fillSelect(headquarterSelect, headquarters, '매장구분을 선택해주세요', headquarters.length === 0);
  resetSelect(departmentSelect, '매장구분을 먼저 선택해주세요', true);
  resetSelect(teamSelect, '부서명을 먼저 선택해주세요', true);
  resetSelect(storeSelect, '팀명을 먼저 선택해주세요', true);
}

/* ==============================
   v25 사용자 흐름 개선
   - 첫 화면 메뉴형
   - 반기평가 진입 전 임명 안내 팝업
   - 매장 선택 후 현재 임명자 선택 → 평가 진행
   - 사용자 화면 본부 기준: 수도권영업본부/지방영업본부
   ============================== */
var selectedAppointmentForEvaluation = null;

function initV19ModuleSwitch() {
  const evaluationModule = document.getElementById('evaluationModule');
  const appointmentModule = document.getElementById('appointmentModule');
  const showEvaluationBtn = document.getElementById('showEvaluationModuleBtn');
  const showAppointmentBtn = document.getElementById('showAppointmentModuleBtn');
  if (!evaluationModule || !appointmentModule || !showEvaluationBtn || !showAppointmentBtn) return;

  evaluationModule.hidden = true;
  appointmentModule.hidden = true;
  showEvaluationBtn.classList.remove('active');
  showAppointmentBtn.classList.remove('active');

  showEvaluationBtn.addEventListener('click', async function () {
    const proceed = await showSubmitModal({
      type: 'confirm',
      title: '관리감독자 임명 확인 안내',
      html: '반기 업무수행평가는 <strong>관리감독자 임명이 완료된 매장</strong>만 진행할 수 있습니다.<br><br>' +
        '<div class="modal-info-box">' +
        '<div><b>1단계</b><span>관리감독자 임명/변경 등록</span></div>' +
        '<div><b>2단계</b><span>임명장 PDF 확인 및 다운로드</span></div>' +
        '<div><b>3단계</b><span>임명된 관리감독자 선택 후 반기평가 진행</span></div>' +
        '</div>' +
        '<p class="modal-small-text">아직 임명 등록이 안 되어 있으면 먼저 임명/변경을 진행해주세요.</p>',
      confirmText: '임명 완료, 평가 진행하기',
      cancelText: '임명/변경 먼저 하기'
    });

    if (!proceed) {
      switchToAppointmentModule();
      return;
    }
    switchToEvaluationModule();
  });

  showAppointmentBtn.addEventListener('click', function () {
    switchToAppointmentModule();
  });
}

function switchToAppointmentModule() {
  const evaluationModule = document.getElementById('evaluationModule');
  const appointmentModule = document.getElementById('appointmentModule');
  const showEvaluationBtn = document.getElementById('showEvaluationModuleBtn');
  const showAppointmentBtn = document.getElementById('showAppointmentModuleBtn');
  if (evaluationModule) evaluationModule.hidden = true;
  if (appointmentModule) appointmentModule.hidden = false;
  if (showAppointmentBtn) showAppointmentBtn.classList.add('active');
  if (showEvaluationBtn) showEvaluationBtn.classList.remove('active');
  ensureAppointmentStoreRow();
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function switchToEvaluationModule() {
  const evaluationModule = document.getElementById('evaluationModule');
  const appointmentModule = document.getElementById('appointmentModule');
  const showEvaluationBtn = document.getElementById('showEvaluationModuleBtn');
  const showAppointmentBtn = document.getElementById('showAppointmentModuleBtn');
  if (evaluationModule) evaluationModule.hidden = false;
  if (appointmentModule) appointmentModule.hidden = true;
  if (showEvaluationBtn) showEvaluationBtn.classList.add('active');
  if (showAppointmentBtn) showAppointmentBtn.classList.remove('active');
  showEntryPage(false);
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function initAppointmentModule() {
  const formEl = document.getElementById('appointmentForm');
  const addBtn = document.getElementById('addAppointmentStoreBtn');
  const empInput = document.getElementById('appointmentEmployeeIdInput');
  const newBtn = document.getElementById('newAppointmentBtn');
  const goEvalBtn = document.getElementById('goEvaluationAfterAppointmentBtn');

  if (addBtn) addBtn.addEventListener('click', addAppointmentStoreRow);
  if (newBtn) newBtn.addEventListener('click', resetAppointmentForm);
  if (goEvalBtn) goEvalBtn.addEventListener('click', function () { switchToEvaluationModule(); });
  if (empInput) {
    empInput.addEventListener('input', function () {
      empInput.value = String(empInput.value || '').replace(/\D/g, '');
      const full = document.getElementById('appointmentEmployeeIdFull');
      if (full) full.value = empInput.value ? 'AD' + empInput.value : '';
    });
  }
  if (formEl) formEl.addEventListener('submit', handleAppointmentSubmit);
}

function bindCascadingOrgSelects() {
  if (headquarterSelect) {
    headquarterSelect.addEventListener('change', function () {
      clearSelectedAppointmentForEvaluation();
      populateDepartments(headquarterSelect.value);
    });
  }
  if (departmentSelect) {
    departmentSelect.addEventListener('change', function () {
      clearSelectedAppointmentForEvaluation();
      populateTeams(headquarterSelect.value, departmentSelect.value);
    });
  }
  if (teamSelect) {
    teamSelect.addEventListener('change', function () {
      clearSelectedAppointmentForEvaluation();
      populateStores(headquarterSelect.value, departmentSelect.value, teamSelect.value);
    });
  }
  if (storeSelect) {
    storeSelect.addEventListener('change', function () {
      clearSelectedAppointmentForEvaluation();
      loadAppointmentsForSelectedStore();
    });
  }
}

function loadOrganizationTree() {
  if (!validateAppsScriptUrl(false)) {
    setOrgMessage('error', 'Apps Script URL을 먼저 script.js에 입력해야 매장정보를 불러올 수 있습니다.');
    showLoading(false);
    return;
  }
  setOrgMessage('pending', '매장정보를 불러오는 중입니다...');
  showLoading(true, '수도권영업본부·지방영업본부 기준 매장정보를 불러오는 중입니다. 잠시만 기다려주세요.', '매장정보를 불러오는 중입니다');
  jsonpRequest({ mode: 'org' }, 30000)
    .then(function (data) {
      if (!data || !data.success) throw new Error(data && data.message ? data.message : '매장정보 불러오기 실패');
      orgTree = data.tree || {};
      populateHeadquarters();
      refreshAppointmentRows();
      setOrgMessage('success', '매장정보를 불러왔습니다. 총 ' + (data.count || 0) + '개 매장 기준입니다.');
      showLoading(false);
    })
    .catch(function (error) {
      console.error(error);
      setOrgMessage('error', '매장정보를 불러오지 못했습니다. 직영점/유통점/유통CAO 시트와 Apps Script 배포 권한을 확인해주세요.');
      resetSelect(headquarterSelect, '매장정보 불러오기 실패', true);
      resetSelect(departmentSelect, '영업본부를 먼저 선택해주세요', true);
      resetSelect(teamSelect, '부서명을 먼저 선택해주세요', true);
      resetSelect(storeSelect, '팀명을 먼저 선택해주세요', true);
      showLoading(false);
    });
}

function populateHeadquarters() {
  const headquarters = Object.keys(orgTree || {}).sort(koreanSort);
  fillSelect(headquarterSelect, headquarters, '영업본부를 선택해주세요', headquarters.length === 0);
  resetSelect(departmentSelect, '영업본부를 먼저 선택해주세요', true);
  resetSelect(teamSelect, '부서명을 먼저 선택해주세요', true);
  resetSelect(storeSelect, '팀명을 먼저 선택해주세요', true);
  clearSelectedAppointmentForEvaluation();
}

async function loadAppointmentsForSelectedStore() {
  const card = document.getElementById('appointmentListCard');
  const list = document.getElementById('appointmentList');
  const status = document.getElementById('appointmentListStatus');
  if (!card || !list || !status) return;

  const storeName = storeSelect ? storeSelect.value : '';
  list.innerHTML = '';
  if (!storeName) {
    card.hidden = true;
    status.textContent = '매장을 선택하면 임명 정보를 확인합니다.';
    return;
  }

  card.hidden = false;
  status.textContent = '임명 정보를 확인 중입니다...';
  list.innerHTML = '<div class="appointed-empty">현재 임명 정보를 불러오는 중입니다.</div>';

  try {
    const data = await jsonpRequest({ mode: 'appointmentList', storeName: storeName }, 20000);
    if (!data || data.success === false) throw new Error(data && data.message ? data.message : '임명자 조회 실패');
    renderAppointmentList(data.appointments || []);
  } catch (err) {
    status.textContent = '조회 실패';
    list.innerHTML = '<div class="appointed-empty">임명 정보를 불러오지 못했습니다.<br>잠시 후 다시 시도하거나 안전보건팀에 문의해주세요.</div>';
  }
}

function renderAppointmentList(appointments) {
  const list = document.getElementById('appointmentList');
  const status = document.getElementById('appointmentListStatus');
  if (!list || !status) return;
  list.innerHTML = '';

  if (!appointments.length) {
    status.textContent = '임명 정보 없음';
    list.innerHTML = '<div class="appointed-empty">해당 매장의 관리감독자 임명 정보가 확인되지 않습니다.<br><b>관리감독자 임명/변경</b>을 먼저 진행해주세요.</div>';
    clearSelectedAppointmentForEvaluation();
    return;
  }

  status.textContent = appointments.length + '명 확인됨';
  appointments.forEach(function (ap, index) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'appointed-person-btn';
    btn.dataset.appointmentIndex = String(index);
    btn.innerHTML = '<div><strong>' + escapeHtml(ap.supervisorName || '') + '</strong>' +
      '<span>' + escapeHtml(ap.employeeId || '') + ' · 선임일 ' + escapeHtml(formatAppointmentDateText(ap.appliedAt || '')) + '</span></div>' +
      '<em class="select-chip">선택</em>';
    btn.addEventListener('click', function () {
      selectAppointmentForEvaluation(ap, btn);
    });
    list.appendChild(btn);
  });
}

function formatAppointmentDateText(value) {
  if (!value) return '-';
  return String(value).slice(0, 10);
}

function selectAppointmentForEvaluation(ap, button) {
  selectedAppointmentForEvaluation = ap || null;
  document.querySelectorAll('.appointed-person-btn').forEach(function (el) { el.classList.remove('selected'); });
  if (button) button.classList.add('selected');
  const nameInput = form && form.elements ? form.elements.supervisorName : null;
  if (nameInput) nameInput.value = ap.supervisorName || '';
  const empId = String(ap.employeeId || '').toUpperCase();
  const digits = empId.replace(/^AD/i, '').replace(/\D/g, '');
  if (employeeIdInput) employeeIdInput.value = digits;
  if (employeeIdFull) employeeIdFull.value = digits ? 'AD' + digits : empId;
  const status = document.getElementById('appointmentListStatus');
  if (status) status.textContent = '임명자 선택 완료';
}

function clearSelectedAppointmentForEvaluation() {
  selectedAppointmentForEvaluation = null;
  document.querySelectorAll('.appointed-person-btn').forEach(function (el) { el.classList.remove('selected'); });
  const nameInput = form && form.elements ? form.elements.supervisorName : null;
  if (nameInput) nameInput.value = '';
  if (employeeIdInput) employeeIdInput.value = '';
  if (employeeIdFull) employeeIdFull.value = '';
  const card = document.getElementById('appointmentListCard');
  const list = document.getElementById('appointmentList');
  const status = document.getElementById('appointmentListStatus');
  if (card) card.hidden = true;
  if (list) list.innerHTML = '';
  if (status) status.textContent = '매장을 선택하면 임명 정보를 확인합니다.';
}

function validateBasicRequired() {
  const requiredFields = [
    [headquarterSelect, '영업본부를 선택해주세요.'],
    [departmentSelect, '부서명을 선택해주세요.'],
    [teamSelect, '팀명을 선택해주세요.'],
    [storeSelect, '매장명을 선택해주세요.']
  ];
  for (const pair of requiredFields) {
    const el = pair[0];
    const message = pair[1];
    if (!el || !String(el.value || '').trim()) {
      setResult('error', message);
      if (el && el.focus) el.focus();
      return false;
    }
  }
  if (!selectedAppointmentForEvaluation) {
    setResult('error', '현재 임명된 관리감독자를 선택해주세요. 임명 정보가 없으면 임명/변경을 먼저 진행해야 합니다.');
    const card = document.getElementById('appointmentListCard');
    if (card) card.scrollIntoView({ behavior: 'smooth', block: 'center' });
    return false;
  }
  return true;
}

function bindEntryPage() {
  if (startEvaluationBtn) {
    startEvaluationBtn.addEventListener('click', async function () {
      clearResult();
      if (!validateAppsScriptUrl()) return;
      if (!validateOrganizationLoaded()) return;
      if (!validateBasicRequired()) return;
      updateEmployeeIdFull();
      const basic = getBasicInfoFromForm();
      startEvaluationBtn.disabled = true;
      showLoading(true, '현재 임명자 정보를 최종 확인 중입니다.', '임명 정보 확인');
      try {
        const appointment = await checkAppointmentBeforeEvaluation(basic);
        showLoading(false);
        if (!appointment || !appointment.allowed) {
          await showSubmitModal({
            type: 'error',
            title: '임명 정보 확인 필요',
            html: escapeHtml((appointment && appointment.message) || '해당 매장의 관리감독자 임명 정보가 확인되지 않습니다.') + '<br><br><p class="modal-small-text">임명/변경을 먼저 진행한 후 반기평가를 진행해주세요.</p>',
            confirmText: '확인'
          });
          return;
        }
        updateSelectedInfoSummary();
        showEvaluationPage();
      } catch (error) {
        showLoading(false);
        await showSubmitModal({ type: 'error', title: '임명 정보 확인 실패', html: escapeHtml(error.message) + '<p class="modal-small-text">계속 오류가 발생하면 안전보건팀에 문의해주세요.</p>', confirmText: '확인' });
      } finally {
        startEvaluationBtn.disabled = false;
      }
    });
  }
  if (editBasicInfoBtn) {
    editBasicInfoBtn.addEventListener('click', function () { showEntryPage(true); });
  }
}

function displayAppointmentResults(results) {
  const formEl = document.getElementById('appointmentForm');
  const success = document.getElementById('appointmentSuccessArea');
  const list = document.getElementById('appointmentDownloadList');
  if (formEl) formEl.hidden = true;
  if (success) success.hidden = false;
  if (list) {
    list.innerHTML = '';
    (results || []).forEach(function (r) {
      const item = document.createElement('div');
      item.className = 'download-item';
      item.innerHTML = '<span>📍 ' + escapeHtml(r.storeName || '') + '</span><a class="btn-small-dl" href="' + escapeHtml(r.viewUrl || '#') + '" target="_blank" rel="noopener">PDF 열기</a>';
      list.appendChild(item);
    });
  }
  showSubmitModal({
    type: 'success',
    title: '임명장 생성 완료',
    html: '임명장 PDF가 생성되었습니다.<br>다운로드 후 바로 반기 업무수행평가를 진행할 수 있습니다.',
    confirmText: '확인'
  });
  window.scrollTo({ top: 0, behavior: 'smooth' });
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
    const good = form.querySelector('input[name="' + item.id + '_result"][value="상"]');
    if (good) good.checked = true;
    applyEvaluationItemState(item.id);
  });
  clearSignature();
  clearSelectedAppointmentForEvaluation();
  resetOrgSelectsAfterSubmit();
  applyAccidentFileRule();
  switchToEvaluationModule();
  showEntryPage(true);
}


/* ==============================
   v29 주간 순회점검표 모듈
   - 기존 반기평가/임명 구조 유지
   - 주간 순회점검표 작성 + 지연 제출 판정 + 사진 가점용 데이터 저장
   ============================== */
const PATROL_ITEMS = [
  { id: 'p09', no: 9, category: '집기', title: '매장입구 행사매대 고정장치', exampleSrc: 'assets/patrol_examples/p09.jpg' },
  { id: 'p10', no: 10, category: '집기', title: '롤링바스켓 POP 부착·적재높이 관리', exampleSrc: 'assets/patrol_examples/p10.jpg' },
  { id: 'p11', no: 11, category: '바닥', title: '매장 바닥 청결 상태', exampleSrc: 'assets/patrol_examples/p11.jpg' },
  { id: 'p12', no: 12, category: '바닥', title: '바닥 타일·신주커버 파손 및 노후', exampleSrc: 'assets/patrol_examples/p12.jpg' },
  { id: 'p14', no: 14, category: '천장', title: '등기구 조명상태', exampleSrc: 'assets/patrol_examples/p14.jpg' },
  { id: 'p22', no: 22, category: '매대', title: '파손우려상품 상품/포장 파손 여부', exampleSrc: 'assets/patrol_examples/p22.jpg' },
  { id: 'p29', no: 29, category: 'POP', title: '상품추락주의 POP 부착', exampleSrc: 'assets/patrol_examples/p29.jpg' },
  { id: 'p30', no: 30, category: 'POP', title: '상품파손주의 POP 부착', exampleSrc: 'assets/patrol_examples/p30.jpg' },
  { id: 'p38', no: 38, category: '집기', title: '보조집기·행사매대·스티커매대 관리', exampleSrc: 'assets/patrol_examples/p38.jpg' },
  { id: 'p39', no: 39, category: '부자재', title: '진열부자재 파손·문제점', exampleSrc: 'assets/patrol_examples/p39.jpg' },
  { id: 'p40', no: 40, category: '부자재', title: '곤도라/벽면 매대 하부서랍장 위험요인', exampleSrc: 'assets/patrol_examples/p40.jpg' },
  { id: 'p42', no: 42, category: '비품', title: '라인용 마스킹테이프 및 박스 적재 기준', exampleSrc: 'assets/patrol_examples/p42.jpg' },
  { id: 'p43', no: 43, category: '비품', title: '모서리보호대 부착', exampleSrc: 'assets/patrol_examples/p43.jpg' },
  { id: 'p44', no: 44, category: '비품', title: '사다리 활용 및 보관상태', exampleSrc: 'assets/patrol_examples/p44.jpg' },
  { id: 'p49', no: 49, category: '소방', title: '방화문·방화셔터 작동구간 적재물', exampleSrc: 'assets/patrol_examples/p49.jpg' },
  { id: 'p52', no: 52, category: 'POP', title: '매장/엘리베이터 홍보 게시물 부착', exampleSrc: 'assets/patrol_examples/p52.jpg' },
  { id: 'p54', no: 54, category: '기타', title: '조명집기 하부 및 전선/콘센트 청소', exampleSrc: 'assets/patrol_examples/p54.jpg' },
  { id: 'p56', no: 56, category: '기타', title: '유리·거울 파손 여부', exampleSrc: 'assets/patrol_examples/p56.jpg' },
  { id: 'p58', no: 58, category: '출입구', title: '백룸 이동통로 단차 및 방해요소', exampleSrc: 'assets/patrol_examples/p58.jpg' },
  { id: 'p59', no: 59, category: 'POP', title: '백룸 포스터 관리', exampleSrc: 'assets/patrol_examples/p59.jpg' },
  { id: 'p60', no: 60, category: '재고', title: '창고 관리기준 준수', exampleSrc: 'assets/patrol_examples/p60.jpg' },
  { id: 'p63', no: 63, category: '소방', title: '백룸 적재박스 스프링클러 간섭', exampleSrc: 'assets/patrol_examples/p63.jpg' },
  { id: 'p64', no: 64, category: '비품', title: '운반도구 L카·롤테이너 사용/관리', exampleSrc: 'assets/patrol_examples/p64.jpg' },
  { id: 'p68', no: 68, category: '게시판', title: '사무실/휴게실 필수 부착물', exampleSrc: 'assets/patrol_examples/p68.jpg' },
  { id: 'p82', no: 82, category: '비품', title: '본사 규정 멀티탭 사용', exampleSrc: 'assets/patrol_examples/p82.jpg' },
  { id: 'p101', no: 101, category: '비품', title: '직원용 안전칼 사용', exampleSrc: 'assets/patrol_examples/p101.jpg' }
];

let patrolSelectedAppointment = null;
let patrolSelectedFiles = {};
let patrolWeekInfo = null;
let patrolHasSignature = false;
let patrolSignatureContext = null;
let patrolSignatureDrawing = false;
let patrolLastSignaturePoint = null;

window.addEventListener('DOMContentLoaded', function () {
  initPatrolModule();
});

function initV19ModuleSwitch() {
  const evaluationModule = document.getElementById('evaluationModule');
  const appointmentModule = document.getElementById('appointmentModule');
  const patrolModule = document.getElementById('patrolModule');
  const showEvaluationBtn = document.getElementById('showEvaluationModuleBtn');
  const showAppointmentBtn = document.getElementById('showAppointmentModuleBtn');
  const showPatrolBtn = document.getElementById('showPatrolModuleBtn');
  if (!evaluationModule || !appointmentModule || !showEvaluationBtn || !showAppointmentBtn) return;

  evaluationModule.hidden = true;
  appointmentModule.hidden = true;
  if (patrolModule) patrolModule.hidden = true;
  showEvaluationBtn.classList.remove('active');
  showAppointmentBtn.classList.remove('active');
  if (showPatrolBtn) showPatrolBtn.classList.remove('active');

  showEvaluationBtn.addEventListener('click', async function () {
    const proceed = await showSubmitModal({
      type: 'confirm',
      title: '관리감독자 임명 확인 안내',
      html: '반기 업무수행평가는 <strong>관리감독자 임명이 완료된 매장</strong>만 진행할 수 있습니다.<br><br>' +
        '<div class="modal-info-box">' +
        '<div><b>1단계</b><span>관리감독자 임명/변경 등록</span></div>' +
        '<div><b>2단계</b><span>주간 순회점검표 작성 누적</span></div>' +
        '<div><b>3단계</b><span>반기평가 진행</span></div>' +
        '</div>' +
        '<p class="modal-small-text">아직 임명 등록이 안 되어 있으면 먼저 임명/변경을 진행해주세요.</p>',
      confirmText: '임명 완료, 평가 진행하기',
      cancelText: '임명/변경 먼저 하기'
    });
    if (!proceed) { switchToAppointmentModule(); return; }
    switchToEvaluationModule();
  });

  showAppointmentBtn.addEventListener('click', function () { switchToAppointmentModule(); });
  if (showPatrolBtn) showPatrolBtn.addEventListener('click', function () { switchToPatrolModule(); });
}

function switchToAppointmentModule() {
  const evaluationModule = document.getElementById('evaluationModule');
  const appointmentModule = document.getElementById('appointmentModule');
  const patrolModule = document.getElementById('patrolModule');
  const showEvaluationBtn = document.getElementById('showEvaluationModuleBtn');
  const showAppointmentBtn = document.getElementById('showAppointmentModuleBtn');
  const showPatrolBtn = document.getElementById('showPatrolModuleBtn');
  if (evaluationModule) evaluationModule.hidden = true;
  if (appointmentModule) appointmentModule.hidden = false;
  if (patrolModule) patrolModule.hidden = true;
  if (showAppointmentBtn) showAppointmentBtn.classList.add('active');
  if (showEvaluationBtn) showEvaluationBtn.classList.remove('active');
  if (showPatrolBtn) showPatrolBtn.classList.remove('active');
  ensureAppointmentStoreRow();
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function switchToEvaluationModule() {
  const evaluationModule = document.getElementById('evaluationModule');
  const appointmentModule = document.getElementById('appointmentModule');
  const patrolModule = document.getElementById('patrolModule');
  const showEvaluationBtn = document.getElementById('showEvaluationModuleBtn');
  const showAppointmentBtn = document.getElementById('showAppointmentModuleBtn');
  const showPatrolBtn = document.getElementById('showPatrolModuleBtn');
  if (evaluationModule) evaluationModule.hidden = false;
  if (appointmentModule) appointmentModule.hidden = true;
  if (patrolModule) patrolModule.hidden = true;
  if (showEvaluationBtn) showEvaluationBtn.classList.add('active');
  if (showAppointmentBtn) showAppointmentBtn.classList.remove('active');
  if (showPatrolBtn) showPatrolBtn.classList.remove('active');
  showEntryPage(false);
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function switchToPatrolModule() {
  const evaluationModule = document.getElementById('evaluationModule');
  const appointmentModule = document.getElementById('appointmentModule');
  const patrolModule = document.getElementById('patrolModule');
  const showEvaluationBtn = document.getElementById('showEvaluationModuleBtn');
  const showAppointmentBtn = document.getElementById('showAppointmentModuleBtn');
  const showPatrolBtn = document.getElementById('showPatrolModuleBtn');
  if (evaluationModule) evaluationModule.hidden = true;
  if (appointmentModule) appointmentModule.hidden = true;
  if (patrolModule) patrolModule.hidden = false;
  if (showEvaluationBtn) showEvaluationBtn.classList.remove('active');
  if (showAppointmentBtn) showAppointmentBtn.classList.remove('active');
  if (showPatrolBtn) showPatrolBtn.classList.add('active');
  updatePatrolWeekInfo();
  populatePatrolHeadquarters();
  setTimeout(function () { resizePatrolSignatureCanvas(true); }, 120);
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function initPatrolModule() {
  renderPatrolItems();
  bindPatrolOrgSelects();
  bindPatrolFileInputs();
  setupPatrolSignaturePad();
  bindPatrolHistoryActions();
  updatePatrolWeekInfo();
  initPatrolPastSearchControls();
  const formEl = document.getElementById('patrolForm');
  if (formEl) formEl.addEventListener('submit', handlePatrolSubmit);
}

function loadOrganizationTree() {
  if (!validateAppsScriptUrl(false)) {
    setOrgMessage('error', 'Apps Script URL을 먼저 script.js에 입력해야 매장정보를 불러올 수 있습니다.');
    showLoading(false);
    return;
  }
  setOrgMessage('pending', '매장정보를 불러오는 중입니다...');
  showLoading(true, '수도권영업본부·지방영업본부 기준 매장정보를 불러오는 중입니다. 잠시만 기다려주세요.', '매장정보를 불러오는 중입니다');
  jsonpRequest({ mode: 'org' }, 30000)
    .then(function (data) {
      if (!data || !data.success) throw new Error(data && data.message ? data.message : '매장정보 불러오기 실패');
      orgTree = data.tree || {};
      populateHeadquarters();
      populatePatrolHeadquarters();
      refreshAppointmentRows();
      setOrgMessage('success', '매장정보를 불러왔습니다. 총 ' + (data.count || 0) + '개 매장 기준입니다.');
      showLoading(false);
    })
    .catch(function (error) {
      console.error(error);
      setOrgMessage('error', '매장정보를 불러오지 못했습니다. 직영점/유통점/유통CAO 시트와 Apps Script 배포 권한을 확인해주세요.');
      resetSelect(headquarterSelect, '매장정보 불러오기 실패', true);
      resetSelect(departmentSelect, '영업본부를 먼저 선택해주세요', true);
      resetSelect(teamSelect, '부서명을 먼저 선택해주세요', true);
      resetSelect(storeSelect, '팀명을 먼저 선택해주세요', true);
      showLoading(false);
    });
}

function renderPatrolItems() {
  const container = document.getElementById('patrolItemsContainer');
  if (!container) return;

  const categoryOrder = [];
  const grouped = {};
  PATROL_ITEMS.forEach(function (item) {
    if (!grouped[item.category]) {
      grouped[item.category] = [];
      categoryOrder.push(item.category);
    }
    grouped[item.category].push(item);
  });

  container.innerHTML = categoryOrder.map(function (category, categoryIndex) {
    const items = grouped[category] || [];
    const itemHtml = items.map(function (item) {
      const photoField = 'patrol_photo_' + item.id;
      const noteId = 'patrol_note_' + item.id;
      return '<div class="patrol-check-item" data-patrol-item-card="' + item.id + '">' +
        '<span class="patrol-check-meta">' + escapeHtml(item.category) + ' · ' + item.no + '번</span>' +
        '<div class="patrol-check-title">' + escapeHtml(item.title) + '</div>' +
        '<div class="patrol-result-buttons" role="radiogroup" aria-label="' + escapeHtml(item.title) + '">' +
        '<label><input type="radio" name="' + item.id + '_result" value="양호" checked />양호</label>' +
        '<label><input type="radio" name="' + item.id + '_result" value="미흡" />미흡</label>' +
        '<label><input type="radio" name="' + item.id + '_result" value="해당없음" />해당없음</label>' +
        '</div>' +
        '<div class="patrol-item-tool-row">' +
          '<button type="button" class="example-btn patrol-example-btn" data-example-src="' + escapeHtml(item.exampleSrc || '') + '" data-example-title="' + escapeHtml(item.no + '번 항목 예시') + '" data-example-caption="' + escapeHtml(item.title + ' PDF 예시와 점검기준입니다.') + '">📒 항목 예시</button>' +
        '</div>' +
        '<div class="patrol-insufficient-panel" data-patrol-insufficient-panel="' + item.id + '" hidden>' +
          '<div class="patrol-insufficient-head"><strong>미흡사항 작성</strong><span>미흡 선택 시 사진과 내용을 필수로 남겨주세요.</span></div>' +
          '<label class="patrol-insufficient-note">미흡사항 내용 <span class="required-mark">*</span>' +
            '<textarea id="' + noteId + '" data-patrol-item-note="' + item.id + '" rows="3" maxlength="300" placeholder="예: 멀티탭 전선 피복 손상 확인, 사용 중지 후 교체 요청"></textarea>' +
          '</label>' +
          '<div class="patrol-item-photo-picker">' +
            '<input class="file-input-hidden" id="' + photoField + '_file" type="file" accept="image/*" multiple data-patrol-file="' + photoField + '" />' +
            '<label class="photo-btn attach patrol-item-photo-btn" for="' + photoField + '_file">📎 미흡사항 사진 첨부</label>' +
            '<div id="' + photoField + '_preview" class="preview-row"><span data-patrol-preview="' + photoField + '"></span><button type="button" class="clear-file-btn" data-clear-patrol-file="' + photoField + '">삭제</button></div>' +
          '</div>' +
        '</div>' +
        '</div>';
    }).join('');

    return '<details class="patrol-category-section" ' + (categoryIndex === 0 ? 'open' : '') + ' data-patrol-category="' + escapeHtml(category) + '">' +
      '<summary class="patrol-category-summary">' +
        '<span class="patrol-category-name">' + escapeHtml(category) + '</span>' +
        '<span class="patrol-category-count">' + items.length + '개 항목</span>' +
        '<span class="patrol-category-status" data-patrol-category-status="' + escapeHtml(category) + '">미흡 0건</span>' +
      '</summary>' +
      '<div class="patrol-category-body"><div class="patrol-category-grid">' + itemHtml + '</div></div>' +
    '</details>';
  }).join('');

  PATROL_ITEMS.forEach(function (item) {
    document.querySelectorAll('input[name="' + item.id + '_result"]').forEach(function (radio) {
      radio.addEventListener('change', function () { applyPatrolItemState(item.id); updatePatrolCategoryStatus(); });
    });
    applyPatrolItemState(item.id);
  });
  updatePatrolCategoryStatus();
}

function updatePatrolCategoryStatus() {
  const counts = {};
  PATROL_ITEMS.forEach(function (item) {
    if (!counts[item.category]) counts[item.category] = 0;
    const checked = document.querySelector('input[name="' + item.id + '_result"]:checked');
    if (checked && checked.value === '미흡') counts[item.category] += 1;
  });
  Object.keys(counts).forEach(function (category) {
    const status = document.querySelector('[data-patrol-category-status="' + cssEscapeSafe(category) + '"]');
    if (!status) return;
    const count = counts[category] || 0;
    status.textContent = count ? '미흡 ' + count + '건' : '미흡 0건';
    status.classList.toggle('has-insufficient', count > 0);
  });
}

function cssEscapeSafe(value) {
  if (window.CSS && typeof window.CSS.escape === 'function') return window.CSS.escape(value);
  return String(value || '').replace(/\"/g, '\"');
}

function applyPatrolItemState(itemId) {
  const checked = document.querySelector('input[name="' + itemId + '_result"]:checked');
  const card = document.querySelector('[data-patrol-item-card="' + itemId + '"]');
  const panel = document.querySelector('[data-patrol-insufficient-panel="' + itemId + '"]');
  const isInsufficient = !!(checked && checked.value === '미흡');
  if (card) card.classList.toggle('insufficient', isInsufficient);
  if (panel) panel.hidden = !isInsufficient;
}

function bindPatrolOrgSelects() {
  const hq = document.getElementById('patrolHeadquarterSelect');
  const dept = document.getElementById('patrolDepartmentSelect');
  const team = document.getElementById('patrolTeamSelect');
  const store = document.getElementById('patrolStoreSelect');
  if (!hq || !dept || !team || !store) return;
  hq.addEventListener('change', function () { clearPatrolAppointment(); populatePatrolDepartments(); });
  dept.addEventListener('change', function () { clearPatrolAppointment(); populatePatrolTeams(); });
  team.addEventListener('change', function () { clearPatrolAppointment(); populatePatrolStores(); });
  store.addEventListener('change', function () { clearPatrolAppointment(); loadPatrolAppointmentsForSelectedStore(); });
}

function populatePatrolHeadquarters() {
  const hq = document.getElementById('patrolHeadquarterSelect');
  const dept = document.getElementById('patrolDepartmentSelect');
  const team = document.getElementById('patrolTeamSelect');
  const store = document.getElementById('patrolStoreSelect');
  if (!hq || !dept || !team || !store) return;
  const headquarters = Object.keys(orgTree || {}).sort(koreanSort);
  fillSelect(hq, headquarters, '영업본부를 선택해주세요', headquarters.length === 0);
  fillSelect(dept, [], '영업본부를 먼저 선택해주세요', true);
  fillSelect(team, [], '부서명을 먼저 선택해주세요', true);
  fillSelect(store, [], '팀명을 먼저 선택해주세요', true);
}

function populatePatrolDepartments() {
  const hq = document.getElementById('patrolHeadquarterSelect');
  const dept = document.getElementById('patrolDepartmentSelect');
  const team = document.getElementById('patrolTeamSelect');
  const store = document.getElementById('patrolStoreSelect');
  const departments = hq && hq.value && orgTree[hq.value] ? Object.keys(orgTree[hq.value]).sort(koreanSort) : [];
  fillSelect(dept, departments, '부서명을 선택해주세요', departments.length === 0);
  fillSelect(team, [], '부서명을 먼저 선택해주세요', true);
  fillSelect(store, [], '팀명을 먼저 선택해주세요', true);
}

function populatePatrolTeams() {
  const hq = document.getElementById('patrolHeadquarterSelect');
  const dept = document.getElementById('patrolDepartmentSelect');
  const team = document.getElementById('patrolTeamSelect');
  const store = document.getElementById('patrolStoreSelect');
  const teams = hq && dept && hq.value && dept.value && orgTree[hq.value] && orgTree[hq.value][dept.value]
    ? Object.keys(orgTree[hq.value][dept.value]).sort(koreanSort)
    : [];
  fillSelect(team, teams, '팀명을 선택해주세요', teams.length === 0);
  fillSelect(store, [], '팀명을 먼저 선택해주세요', true);
}

function populatePatrolStores() {
  const hq = document.getElementById('patrolHeadquarterSelect');
  const dept = document.getElementById('patrolDepartmentSelect');
  const team = document.getElementById('patrolTeamSelect');
  const store = document.getElementById('patrolStoreSelect');
  const stores = hq && dept && team && hq.value && dept.value && team.value && orgTree[hq.value] && orgTree[hq.value][dept.value] && orgTree[hq.value][dept.value][team.value]
    ? orgTree[hq.value][dept.value][team.value].slice().sort(koreanSort)
    : [];
  fillSelect(store, stores, '매장명을 선택해주세요', stores.length === 0);
}

async function loadPatrolAppointmentsForSelectedStore() {
  const store = document.getElementById('patrolStoreSelect');
  const card = document.getElementById('patrolAppointmentListCard');
  const list = document.getElementById('patrolAppointmentList');
  const status = document.getElementById('patrolAppointmentListStatus');
  if (!store || !card || !list || !status) return;
  const storeName = store.value;
  if (!storeName) { card.hidden = true; return; }
  card.hidden = false;
  status.textContent = '임명 정보를 확인 중입니다...';
  list.innerHTML = '<div class="appointed-empty">현재 임명 정보를 불러오는 중입니다.</div>';
  try {
    const data = await jsonpRequest({ mode: 'appointmentList', storeName: storeName }, 20000);
    if (!data || data.success === false) throw new Error(data && data.message ? data.message : '임명자 조회 실패');
    renderPatrolAppointmentList(data.appointments || []);
  } catch (err) {
    status.textContent = '조회 실패';
    list.innerHTML = '<div class="appointed-empty">임명 정보를 불러오지 못했습니다.<br>잠시 후 다시 시도하거나 안전보건팀에 문의해주세요.</div>';
  }
}

function renderPatrolAppointmentList(appointments) {
  const list = document.getElementById('patrolAppointmentList');
  const status = document.getElementById('patrolAppointmentListStatus');
  if (!list || !status) return;
  list.innerHTML = '';
  if (!appointments.length) {
    status.textContent = '임명 정보 없음';
    list.innerHTML = '<div class="appointed-empty">해당 매장의 관리감독자 임명 정보가 확인되지 않습니다.<br><b>관리감독자 임명/변경</b>을 먼저 진행해주세요.</div>';
    return;
  }
  status.textContent = appointments.length + '명 확인됨';
  appointments.forEach(function (ap, index) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'appointed-person-btn';
    btn.innerHTML = '<div><strong>' + escapeHtml(ap.supervisorName || '') + '</strong>' +
      '<span>' + escapeHtml(ap.employeeId || '') + ' · 선임일 ' + escapeHtml(formatAppointmentDateText(ap.appliedAt || '')) + '</span></div>' +
      '<em class="select-chip">선택</em>';
    btn.addEventListener('click', function () { selectPatrolAppointment(ap, btn); });
    list.appendChild(btn);
  });
}

function selectPatrolAppointment(ap, button) {
  patrolSelectedAppointment = ap || null;
  document.querySelectorAll('#patrolAppointmentList .appointed-person-btn').forEach(function (el) { el.classList.remove('selected'); });
  if (button) button.classList.add('selected');
  const nameInput = document.getElementById('patrolSupervisorNameInput');
  const empInput = document.getElementById('patrolEmployeeIdInput');
  const full = document.getElementById('patrolEmployeeIdFull');
  const empId = String(ap.employeeId || '').toUpperCase();
  const digits = empId.replace(/^AD/i, '').replace(/\D/g, '');
  if (nameInput) nameInput.value = ap.supervisorName || '';
  if (empInput) empInput.value = digits;
  if (full) full.value = digits ? 'AD' + digits : empId;
  const status = document.getElementById('patrolAppointmentListStatus');
  if (status) status.textContent = '임명자 선택 완료';
}

function clearPatrolAppointment() {
  patrolSelectedAppointment = null;
  document.querySelectorAll('#patrolAppointmentList .appointed-person-btn').forEach(function (el) { el.classList.remove('selected'); });
  const nameInput = document.getElementById('patrolSupervisorNameInput');
  const empInput = document.getElementById('patrolEmployeeIdInput');
  const full = document.getElementById('patrolEmployeeIdFull');
  if (nameInput) nameInput.value = '';
  if (empInput) empInput.value = '';
  if (full) full.value = '';
  const card = document.getElementById('patrolAppointmentListCard');
  const list = document.getElementById('patrolAppointmentList');
  const status = document.getElementById('patrolAppointmentListStatus');
  if (card) card.hidden = true;
  if (list) list.innerHTML = '';
  if (status) status.textContent = '매장을 선택하면 임명 정보를 확인합니다.';
}

function updatePatrolWeekInfo() {
  patrolWeekInfo = getCurrentPatrolWeekInfo();
  const title = document.getElementById('patrolWeekTitle');
  const period = document.getElementById('patrolWeekPeriod');
  if (title) title.textContent = patrolWeekInfo.year + '년 ' + patrolWeekInfo.month + '월 ' + patrolWeekInfo.weekNo + '주차';
  if (period) period.textContent = '제출 가능 기간 ' + formatMonthDayWeekday(patrolWeekInfo.startDate) + ' ~ ' + formatMonthDayWeekday(patrolWeekInfo.endDate);
}

function getCurrentPatrolWeekInfo() {
  const today = new Date();
  const base = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const diff = (base.getDay() + 6) % 7;
  const start = new Date(base);
  start.setDate(base.getDate() - diff);
  const end = new Date(start);
  end.setDate(start.getDate() + 6);
  const monthStart = new Date(start.getFullYear(), start.getMonth(), 1);
  const firstDiff = (monthStart.getDay() + 6) % 7;
  const weekNo = Math.floor((start.getDate() + firstDiff - 1) / 7) + 1;
  const year = start.getFullYear();
  const month = start.getMonth() + 1;
  const weekKey = year + '-' + String(month).padStart(2, '0') + '-W' + String(weekNo).padStart(2, '0');
  return {
    year: year,
    month: month,
    weekNo: weekNo,
    weekKey: weekKey,
    startDate: toDateOnly(start),
    endDate: toDateOnly(end)
  };
}

function toDateOnly(date) {
  return date.getFullYear() + '-' + String(date.getMonth() + 1).padStart(2, '0') + '-' + String(date.getDate()).padStart(2, '0');
}

function formatMonthDayWeekday(dateText) {
  const date = new Date(dateText + 'T00:00:00');
  const weekdays = ['일','월','화','수','목','금','토'];
  return (date.getMonth() + 1) + '/' + date.getDate() + '(' + weekdays[date.getDay()] + ')';
}

function bindPatrolFileInputs() {
  document.addEventListener('change', function (event) {
    const input = event.target;
    if (!input.matches('[data-patrol-file]')) return;
    const field = input.getAttribute('data-patrol-file');
    const files = Array.from(input.files || []);
    if (!files.length) return;
    const invalid = files.find(function (file) { return !file.type || !file.type.startsWith('image/'); });
    if (invalid) {
      alert('이미지 파일만 첨부할 수 있습니다.');
      input.value = '';
      return;
    }
    const existing = Array.isArray(patrolSelectedFiles[field]) ? patrolSelectedFiles[field] : [];
    patrolSelectedFiles[field] = existing.concat(files);
    updatePatrolFilePreview(field);
    input.value = '';
  });
  document.addEventListener('click', function (event) {
    const btn = event.target.closest('[data-clear-patrol-file]');
    if (!btn) return;
    const field = btn.getAttribute('data-clear-patrol-file');
    delete patrolSelectedFiles[field];
    updatePatrolFilePreview(field);
  });
}

function updatePatrolFilePreview(field) {
  const row = document.getElementById(field + '_preview');
  const span = document.querySelector('[data-patrol-preview="' + field + '"]');
  const files = patrolSelectedFiles[field] || [];
  if (!row || !span) return;
  if (!files.length) {
    row.classList.remove('active');
    span.textContent = '';
    return;
  }
  row.classList.add('active');
  span.textContent = files.length === 1 ? '첨부됨: 1장 · ' + files[0].name : '첨부됨: 총 ' + files.length + '장';
}

function setupPatrolSignaturePad() {
  const pad = document.getElementById('patrolSignaturePad');
  const clearBtn = document.getElementById('clearPatrolSignatureBtn');
  if (!pad) return;
  patrolSignatureContext = pad.getContext('2d');
  resizePatrolSignatureCanvas(false);
  pad.addEventListener('pointerdown', startPatrolSignature);
  pad.addEventListener('pointermove', drawPatrolSignature);
  pad.addEventListener('pointerup', endPatrolSignature);
  pad.addEventListener('pointercancel', endPatrolSignature);
  pad.addEventListener('pointerleave', endPatrolSignature);
  if (clearBtn) clearBtn.addEventListener('click', clearPatrolSignature);
  window.addEventListener('resize', debounce(function () { resizePatrolSignatureCanvas(true); }, 250));
}

function resizePatrolSignatureCanvas(keepExisting) {
  const pad = document.getElementById('patrolSignaturePad');
  if (!pad || !patrolSignatureContext) return;
  let oldDataUrl = '';
  if (keepExisting && patrolHasSignature) oldDataUrl = pad.toDataURL('image/png');
  const ratio = Math.max(window.devicePixelRatio || 1, 1);
  const rect = pad.getBoundingClientRect();
  const width = Math.max(rect.width, 300);
  const height = Math.max(rect.height, 160);
  pad.width = Math.round(width * ratio);
  pad.height = Math.round(height * ratio);
  patrolSignatureContext.setTransform(ratio, 0, 0, ratio, 0, 0);
  patrolSignatureContext.lineWidth = 3;
  patrolSignatureContext.lineCap = 'round';
  patrolSignatureContext.lineJoin = 'round';
  patrolSignatureContext.strokeStyle = '#111827';
  if (oldDataUrl) {
    const img = new Image();
    img.onload = function () { patrolSignatureContext.drawImage(img, 0, 0, width, height); };
    img.src = oldDataUrl;
  }
}

function getPatrolSignaturePoint(event) {
  const pad = document.getElementById('patrolSignaturePad');
  const rect = pad.getBoundingClientRect();
  return { x: event.clientX - rect.left, y: event.clientY - rect.top };
}
function startPatrolSignature(event) {
  const pad = document.getElementById('patrolSignaturePad');
  const wrap = document.querySelector('.patrol-signature-wrap');
  event.preventDefault();
  pad.setPointerCapture(event.pointerId);
  patrolSignatureDrawing = true;
  patrolLastSignaturePoint = getPatrolSignaturePoint(event);
  patrolHasSignature = true;
  if (wrap) wrap.classList.add('signed');
}
function drawPatrolSignature(event) {
  if (!patrolSignatureDrawing || !patrolLastSignaturePoint) return;
  event.preventDefault();
  const point = getPatrolSignaturePoint(event);
  patrolSignatureContext.beginPath();
  patrolSignatureContext.moveTo(patrolLastSignaturePoint.x, patrolLastSignaturePoint.y);
  patrolSignatureContext.lineTo(point.x, point.y);
  patrolSignatureContext.stroke();
  patrolLastSignaturePoint = point;
}
function endPatrolSignature(event) {
  if (!patrolSignatureDrawing) return;
  event.preventDefault();
  patrolSignatureDrawing = false;
  patrolLastSignaturePoint = null;
}
function clearPatrolSignature() {
  const pad = document.getElementById('patrolSignaturePad');
  const wrap = document.querySelector('.patrol-signature-wrap');
  if (!pad || !patrolSignatureContext) return;
  const rect = pad.getBoundingClientRect();
  patrolSignatureContext.clearRect(0, 0, rect.width, rect.height);
  patrolHasSignature = false;
  if (wrap) wrap.classList.remove('signed');
}
function getPatrolSignatureDataUrl() {
  const pad = document.getElementById('patrolSignaturePad');
  const rect = pad.getBoundingClientRect();
  const exportCanvas = document.createElement('canvas');
  exportCanvas.width = Math.round(rect.width);
  exportCanvas.height = Math.round(rect.height);
  const ctx = exportCanvas.getContext('2d');
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, exportCanvas.width, exportCanvas.height);
  ctx.drawImage(pad, 0, 0, exportCanvas.width, exportCanvas.height);
  return exportCanvas.toDataURL('image/jpeg', 0.82);
}

function getPatrolBasicInfo() {
  const hq = document.getElementById('patrolHeadquarterSelect');
  const dept = document.getElementById('patrolDepartmentSelect');
  const team = document.getElementById('patrolTeamSelect');
  const store = document.getElementById('patrolStoreSelect');
  const name = document.getElementById('patrolSupervisorNameInput');
  const emp = document.getElementById('patrolEmployeeIdFull');
  return {
    headquarter: hq ? hq.value : '',
    department: dept ? dept.value : '',
    team: team ? team.value : '',
    storeName: store ? store.value : '',
    supervisorName: name ? normalizeText(name.value || '') : '',
    employeeId: emp ? emp.value : ''
  };
}

function validatePatrolBasic() {
  const fields = [
    [document.getElementById('patrolHeadquarterSelect'), '영업본부를 선택해주세요.'],
    [document.getElementById('patrolDepartmentSelect'), '부서명을 선택해주세요.'],
    [document.getElementById('patrolTeamSelect'), '팀명을 선택해주세요.'],
    [document.getElementById('patrolStoreSelect'), '매장명을 선택해주세요.']
  ];
  for (const pair of fields) {
    if (!pair[0] || !String(pair[0].value || '').trim()) {
      setPatrolResult('error', pair[1]);
      if (pair[0] && pair[0].focus) pair[0].focus();
      return false;
    }
  }
  if (!patrolSelectedAppointment) {
    setPatrolResult('error', '현재 임명된 관리감독자를 선택해주세요. 임명 정보가 없으면 임명/변경을 먼저 진행해야 합니다.');
    const card = document.getElementById('patrolAppointmentListCard');
    if (card) card.scrollIntoView({ behavior: 'smooth', block: 'center' });
    return false;
  }
  for (const item of PATROL_ITEMS) {
    const checked = document.querySelector('input[name="' + item.id + '_result"]:checked');
    if (checked && checked.value === '미흡') {
      const note = document.getElementById('patrol_note_' + item.id);
      const files = patrolSelectedFiles['patrol_photo_' + item.id] || [];
      if (!note || !String(note.value || '').trim()) {
        setPatrolResult('error', item.no + '번 ' + item.title + ' 항목의 미흡사항 내용을 입력해주세요.');
        const panel = document.querySelector('[data-patrol-insufficient-panel="' + item.id + '"]');
        if (panel) panel.scrollIntoView({ behavior: 'smooth', block: 'center' });
        if (note && note.focus) note.focus();
        return false;
      }
      if (!files.length) {
        setPatrolResult('error', item.no + '번 ' + item.title + ' 항목의 미흡사항 사진을 첨부해주세요.');
        const panel = document.querySelector('[data-patrol-insufficient-panel="' + item.id + '"]');
        if (panel) panel.scrollIntoView({ behavior: 'smooth', block: 'center' });
        return false;
      }
    }
  }
  if (!patrolHasSignature) {
    setPatrolResult('error', '제출 전 서명란에 서명해주세요.');
    const wrap = document.querySelector('.patrol-signature-wrap');
    if (wrap) wrap.scrollIntoView({ behavior: 'smooth', block: 'center' });
    return false;
  }
  return true;
}

function getPatrolInsufficientCount() {
  return PATROL_ITEMS.filter(function (item) {
    const checked = document.querySelector('input[name="' + item.id + '_result"]:checked');
    return checked && checked.value === '미흡';
  }).length;
}

function getPatrolItemPhotoCount() {
  return PATROL_ITEMS.reduce(function (sum, item) {
    return sum + ((patrolSelectedFiles['patrol_photo_' + item.id] || []).length);
  }, 0);
}

async function handlePatrolSubmit(event) {
  event.preventDefault();
  setPatrolResult('', '');
  if (!validateAppsScriptUrl()) return;
  if (!validateOrganizationLoaded()) return;
  if (!validatePatrolBasic()) return;
  updatePatrolWeekInfo();
  const basic = getPatrolBasicInfo();
  const confirmed = await showSubmitModal({
    type: 'confirm',
    title: '주간순회점검표 제출 전 확인',
    html: '<div class="modal-info-box">' +
      '<div><b>주차</b><span>' + escapeHtml(patrolWeekInfo.year + '년 ' + patrolWeekInfo.month + '월 ' + patrolWeekInfo.weekNo + '주차') + '</span></div>' +
      '<div><b>매장명</b><span>' + escapeHtml(basic.storeName) + '</span></div>' +
      '<div><b>성명</b><span>' + escapeHtml(basic.supervisorName) + '</span></div>' +
      '<div><b>사번</b><span>' + escapeHtml(basic.employeeId) + '</span></div>' +
      '<div><b>미흡항목</b><span>' + getPatrolInsufficientCount() + '개</span></div>' +
      '<div><b>미흡사진</b><span>' + getPatrolItemPhotoCount() + '장</span></div>' +
      '</div><p class="modal-small-text">미흡 항목은 사진과 내용이 함께 저장됩니다. 동일 주차는 1회만 제출할 수 있습니다.</p>',
    confirmText: '확인 후 제출',
    cancelText: '수정하기'
  });
  if (!confirmed) return;

  const submitBtnEl = document.getElementById('patrolSubmitBtn');
  try {
    if (submitBtnEl) { submitBtnEl.disabled = true; submitBtnEl.textContent = '제출 중입니다...'; }
    showLoading(true, '사진을 압축하고 주간순회점검표를 준비 중입니다.', '주간순회점검표 제출 중');
    const payload = await buildPatrolPayload();
    await postPayloadByHiddenForm(payload);
    showLoading(true, '자료가 전송되었습니다. 저장 완료 여부를 확인 중입니다.');
    const status = await waitForPatrolStatus(payload.submissionId);
    if (!status || !status.success) throw new Error(status && status.message ? status.message : '저장 상태 확인 실패');
    showLoading(false);
    await showSubmitModal({
      type: 'success',
      title: '제출이 완료되었습니다',
      html: '<div class="modal-info-box">' +
        '<div><b>제출상태</b><span>' + escapeHtml(status.submitStatus || '저장 완료') + '</span></div>' +
        '<div><b>매장명</b><span>' + escapeHtml(basic.storeName) + '</span></div>' +
        '<div><b>주차</b><span>' + escapeHtml(patrolWeekInfo.weekKey) + '</span></div>' +
        '</div><p class="modal-small-text">제출 결과는 순회점검_DB와 월별/반기 집계 시트에 자동 반영됩니다.</p>',
      confirmText: '확인'
    });
    resetPatrolFormAfterSuccess();
  } catch (err) {
    showLoading(false);
    await showSubmitModal({ type: 'error', title: '제출 중 오류가 발생했습니다', html: escapeHtml(err.message), confirmText: '확인' });
  } finally {
    if (submitBtnEl) { submitBtnEl.disabled = false; submitBtnEl.textContent = '주간순회점검표 제출하기'; }
    showLoading(false);
  }
}

async function buildPatrolPayload() {
  const submissionId = 'PT-' + new Date().toISOString().replace(/[-:.TZ]/g, '').slice(0, 14) + '-' + Math.random().toString(36).slice(2, 10);
  const items = PATROL_ITEMS.map(function (item) {
    const checked = document.querySelector('input[name="' + item.id + '_result"]:checked');
    const noteEl = document.getElementById('patrol_note_' + item.id);
    const photoField = 'patrol_photo_' + item.id;
    return { id: item.id, no: item.no, category: item.category, title: item.title, result: checked ? checked.value : '양호', note: noteEl ? normalizeText(noteEl.value || '') : '', photoField: photoField, photoCount: (patrolSelectedFiles[photoField] || []).length };
  });
  const attachments = await collectPatrolAttachments(submissionId);
  attachments.push({ field: 'patrol_signature', label: '주간순회점검 제출자 전자서명', hasFile: true, originalName: 'patrol_signature.jpg', fileName: submissionId + '_patrol_signature.jpg', mimeType: 'image/jpeg', size: getPatrolSignatureDataUrl().length, dataUrl: getPatrolSignatureDataUrl() });
  return { type: 'weeklyPatrol', submissionId: submissionId, submittedAtClient: new Date().toISOString(), userAgent: navigator.userAgent || '', basic: getPatrolBasicInfo(), week: patrolWeekInfo || getCurrentPatrolWeekInfo(), items: items, attachments: attachments };
}

async function collectPatrolAttachments(submissionId) {
  const fields = PATROL_ITEMS.map(function (item) { return { name: 'patrol_photo_' + item.id, label: item.no + '번 미흡사항 사진 - ' + item.title }; });
  const attachments = [];
  for (const field of fields) {
    const files = patrolSelectedFiles[field.name] || [];
    if (!files.length) { attachments.push({ field: field.name, label: field.label, hasFile: false }); continue; }
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const processed = await processImageFile(file);
      const suffix = files.length > 1 ? '_' + (i + 1) : '';
      attachments.push({ field: field.name, label: field.label + (files.length > 1 ? ' ' + (i + 1) + '/' + files.length : ''), hasFile: true, fileIndex: i + 1, fileCount: files.length, originalName: file.name, fileName: submissionId + '_' + field.name + suffix + '_' + sanitizeFileName(file.name), mimeType: processed.mimeType, size: processed.size, originalSize: processed.originalSize || file.size || 0, compressed: !!processed.compressed, dataUrl: processed.dataUrl });
    }
  }
  return attachments;
}

function waitForPatrolStatus(submissionId) {
  const started = Date.now();
  const timeoutMs = 100000;
  const intervalMs = 2200;
  return new Promise(function (resolve, reject) {
    function poll() {
      jsonpRequest({ mode: 'patrolStatus', submissionId: submissionId }, 20000)
        .then(function (data) {
          if (data && data.found) {
            if (data.success) resolve(data);
            else reject(new Error(data.message || '저장 실패'));
            return;
          }
          if (Date.now() - started > timeoutMs) return reject(new Error('저장 완료 확인 시간이 초과되었습니다. 순회점검_DB 시트를 확인해주세요.'));
          setTimeout(poll, intervalMs);
        })
        .catch(function () {
          if (Date.now() - started > timeoutMs) return reject(new Error('저장 상태 확인에 실패했습니다. 네트워크 상태를 확인해주세요.'));
          setTimeout(poll, intervalMs);
        });
    }
    poll();
  });
}


function bindPatrolHistoryActions() {
  const prevBtn = document.getElementById('patrolPrevWeekBtn');
  const toggleBtn = document.getElementById('patrolPastSearchToggleBtn');
  const searchBtn = document.getElementById('patrolPastSearchBtn');
  if (prevBtn) prevBtn.addEventListener('click', function () {
    loadPatrolResultForWeek(getPatrolRelativeWeekInfo(-1), '전주 점검결과');
  });
  if (toggleBtn) toggleBtn.addEventListener('click', function () {
    const box = document.getElementById('patrolPastSearchBox');
    if (!box) return;
    box.hidden = !box.hidden;
    if (!box.hidden) initPatrolPastSearchControls();
  });
  if (searchBtn) searchBtn.addEventListener('click', function () {
    const year = Number((document.getElementById('patrolSearchYear') || {}).value || 0);
    const month = Number((document.getElementById('patrolSearchMonth') || {}).value || 0);
    const weekNo = Number((document.getElementById('patrolSearchWeek') || {}).value || 0);
    if (!year || !month || !weekNo) {
      setPatrolResult('error', '조회할 연도, 월, 주차를 선택해주세요.');
      return;
    }
    loadPatrolResultForWeek(makePatrolWeekInfoFromParts(year, month, weekNo), '과거 점검결과');
  });
}

function initPatrolPastSearchControls() {
  const yearSelect = document.getElementById('patrolSearchYear');
  const monthSelect = document.getElementById('patrolSearchMonth');
  const weekSelect = document.getElementById('patrolSearchWeek');
  if (!yearSelect || !monthSelect || !weekSelect) return;
  const current = patrolWeekInfo || getCurrentPatrolWeekInfo();
  if (!yearSelect.options.length) {
    for (let y = current.year - 1; y <= current.year + 1; y++) {
      const opt = document.createElement('option');
      opt.value = String(y);
      opt.textContent = y + '년';
      yearSelect.appendChild(opt);
    }
  }
  if (!monthSelect.options.length) {
    for (let m = 1; m <= 12; m++) {
      const opt = document.createElement('option');
      opt.value = String(m);
      opt.textContent = m + '월';
      monthSelect.appendChild(opt);
    }
  }
  if (!weekSelect.options.length) {
    for (let w = 1; w <= 6; w++) {
      const opt = document.createElement('option');
      opt.value = String(w);
      opt.textContent = w + '주차';
      weekSelect.appendChild(opt);
    }
  }
  yearSelect.value = String(current.year);
  monthSelect.value = String(current.month);
  weekSelect.value = String(current.weekNo);
}

function getPatrolRelativeWeekInfo(offsetWeeks) {
  const current = patrolWeekInfo || getCurrentPatrolWeekInfo();
  const base = new Date(current.startDate + 'T00:00:00');
  base.setDate(base.getDate() + (offsetWeeks * 7));
  return getPatrolWeekInfoByDate(base);
}

function getPatrolWeekInfoByDate(date) {
  const base = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const diff = (base.getDay() + 6) % 7;
  const start = new Date(base);
  start.setDate(base.getDate() - diff);
  const end = new Date(start);
  end.setDate(start.getDate() + 6);
  const monthStart = new Date(start.getFullYear(), start.getMonth(), 1);
  const firstDiff = (monthStart.getDay() + 6) % 7;
  const weekNo = Math.floor((start.getDate() + firstDiff - 1) / 7) + 1;
  const year = start.getFullYear();
  const month = start.getMonth() + 1;
  const weekKey = year + '-' + String(month).padStart(2, '0') + '-W' + String(weekNo).padStart(2, '0');
  return { year, month, weekNo, weekKey, startDate: toDateOnly(start), endDate: toDateOnly(end) };
}

function makePatrolWeekInfoFromParts(year, month, weekNo) {
  const weekKey = year + '-' + String(month).padStart(2, '0') + '-W' + String(weekNo).padStart(2, '0');
  return { year, month, weekNo, weekKey, startDate: '', endDate: '' };
}

async function loadPatrolResultForWeek(weekInfo, titlePrefix) {
  setPatrolResult('', '');
  if (!validateAppsScriptUrl()) return;
  if (!validateOrganizationLoaded()) return;
  const basic = getPatrolBasicInfo();
  if (!basic.storeName) {
    setPatrolResult('error', '점검결과를 조회할 매장을 먼저 선택해주세요.');
    const store = document.getElementById('patrolStoreSelect');
    if (store && store.focus) store.focus();
    return;
  }
  if (!basic.employeeId) {
    setPatrolResult('error', '현재 임명된 관리감독자를 먼저 선택해주세요.');
    const card = document.getElementById('patrolAppointmentListCard');
    if (card) card.scrollIntoView({ behavior: 'smooth', block: 'center' });
    return;
  }
  const viewer = document.getElementById('patrolResultViewer');
  const body = document.getElementById('patrolResultViewerBody');
  const title = document.getElementById('patrolResultViewerTitle');
  if (viewer) viewer.hidden = false;
  if (title) title.textContent = titlePrefix + ' - ' + weekInfo.weekKey;
  if (body) body.innerHTML = '<div class="inline-message pending">점검결과를 불러오는 중입니다...</div>';
  if (viewer) viewer.scrollIntoView({ behavior: 'smooth', block: 'start' });
  try {
    const data = await jsonpRequest({
      mode: 'patrolDetail',
      storeName: basic.storeName,
      employeeId: basic.employeeId,
      weekKey: weekInfo.weekKey
    }, 30000);
    renderPatrolResultViewer(data, titlePrefix, weekInfo);
  } catch (err) {
    if (body) body.innerHTML = '<div class="inline-message error">점검결과 조회 중 오류가 발생했습니다. ' + escapeHtml(err.message) + '</div>';
  }
}

function renderPatrolResultViewer(data, titlePrefix, weekInfo) {
  const body = document.getElementById('patrolResultViewerBody');
  const title = document.getElementById('patrolResultViewerTitle');
  if (!body) return;
  if (!data || data.success === false || !data.found) {
    body.innerHTML = '<div class="patrol-empty-result">' +
      '<strong>제출된 점검표가 없습니다.</strong>' +
      '<p>' + escapeHtml((data && data.message) || '선택한 매장·관리감독자·주차 기준 제출 내역이 없습니다.') + '</p>' +
      '<p class="modal-small-text">조회 주차: ' + escapeHtml(weekInfo.weekKey) + '</p>' +
      '</div>';
    return;
  }
  const rec = data.record || {};
  if (title) title.textContent = titlePrefix + ' - ' + (rec.weekLabel || rec.weekKey || weekInfo.weekKey);
  const summary = rec.summary || {};
  const insufficientItems = (rec.items || []).filter(function (item) { return item.result === '미흡'; });
  const tbmText = buildPatrolTbmText(rec, insufficientItems);
  const categories = groupPatrolResultItems(rec.items || []);
  const detailHtml = Object.keys(categories).map(function (category, index) {
    const items = categories[category];
    const bad = items.filter(function (item) { return item.result === '미흡'; }).length;
    return '<details class="patrol-result-category" ' + (index === 0 || bad > 0 ? 'open' : '') + '>' +
      '<summary><strong>' + escapeHtml(category) + '</strong><span>' + items.length + '개 항목 · 미흡 ' + bad + '건</span></summary>' +
      '<div class="patrol-result-item-list">' + items.map(renderPatrolResultItem).join('') + '</div>' +
      '</details>';
  }).join('');
  body.innerHTML = '<div class="patrol-result-toolbar no-print">' +
      '<button type="button" class="sub-btn" id="copyPatrolTbmBtn">TBM 공유문구 복사</button>' +
      '<button type="button" class="sub-btn" id="printPatrolResultBtn">점검결과 인쇄/저장</button>' +
    '</div>' +
    '<div class="patrol-print-area" id="patrolPrintArea">' +
      '<div class="patrol-result-header">' +
        '<div><span class="badge-soft">읽기 전용</span><h3>관리감독자 주간 순회점검표</h3><p>' + escapeHtml(rec.weekLabel || rec.weekKey || '') + '</p></div>' +
        '<div class="patrol-result-status ' + escapeHtml(rec.submitStatusClass || '') + '">' + escapeHtml(rec.submitStatus || '') + '</div>' +
      '</div>' +
      '<div class="patrol-result-info-grid">' +
        '<div><b>매장명</b><span>' + escapeHtml(rec.storeName || '') + '</span></div>' +
        '<div><b>점검자</b><span>' + escapeHtml((rec.supervisorName || '') + ' / ' + (rec.employeeId || '')) + '</span></div>' +
        '<div><b>제출일시</b><span>' + escapeHtml(rec.submittedAt || '') + '</span></div>' +
        '<div><b>주차</b><span>' + escapeHtml(rec.weekKey || '') + '</span></div>' +
      '</div>' +
      '<div class="patrol-result-summary-grid">' +
        '<div><strong>' + (summary.total || 0) + '</strong><span>총 항목</span></div>' +
        '<div><strong>' + (summary.good || 0) + '</strong><span>양호</span></div>' +
        '<div><strong>' + (summary.bad || 0) + '</strong><span>미흡</span></div>' +
        '<div><strong>' + (summary.na || 0) + '</strong><span>해당없음</span></div>' +
        '<div><strong>' + (summary.validPhotos || 0) + '</strong><span>유효사진</span></div>' +
      '</div>' +
      '<div class="patrol-tbm-box">' +
        '<h3>TBM 공유용 요약</h3>' +
        renderPatrolTbmSummary(insufficientItems, rec) +
      '</div>' +
      '<div class="patrol-result-detail">' + detailHtml + '</div>' +
    '</div>';
  const copyBtn = document.getElementById('copyPatrolTbmBtn');
  if (copyBtn) copyBtn.addEventListener('click', function () { copyTextToClipboard(tbmText); });
  const printBtn = document.getElementById('printPatrolResultBtn');
  if (printBtn) printBtn.addEventListener('click', function () { window.print(); });
}

function groupPatrolResultItems(items) {
  return (items || []).reduce(function (acc, item) {
    const key = item.category || '기타';
    if (!acc[key]) acc[key] = [];
    acc[key].push(item);
    return acc;
  }, {});
}

function renderPatrolResultItem(item) {
  const cls = item.result === '미흡' ? 'bad' : (item.result === '해당없음' ? 'na' : 'good');
  const photos = (item.photoUrls || []).map(function (url, index) {
    return '<a href="' + escapeHtml(url) + '" target="_blank" rel="noopener">사진 ' + (index + 1) + '</a>';
  }).join('');
  return '<div class="patrol-result-item ' + cls + '">' +
    '<div class="patrol-result-item-head"><strong>' + escapeHtml(item.no + '. ' + item.title) + '</strong><span>' + escapeHtml(item.result || '') + '</span></div>' +
    (item.note ? '<p><b>미흡내용</b> ' + escapeHtml(item.note) + '</p>' : '') +
    (photos ? '<div class="patrol-result-photos"><b>첨부사진</b> ' + photos + '</div>' : '') +
    '</div>';
}

function renderPatrolTbmSummary(insufficientItems, rec) {
  if (!insufficientItems.length) {
    return '<p class="patrol-tbm-empty">전주 점검결과 미흡사항은 없습니다. 이번 주에도 통로 확보, 창고 정리정돈, 전기·소방 상태를 유지해주세요.</p>';
  }
  return '<ol>' + insufficientItems.map(function (item) {
    return '<li><strong>' + escapeHtml(item.title || '') + '</strong><br>' +
      '<span>미흡내용: ' + escapeHtml(item.note || '미흡내용 확인 필요') + '</span><br>' +
      '<span>공유사항: 동일 위험요인이 반복되지 않도록 작업 전 확인 바랍니다.</span></li>';
  }).join('') + '</ol>';
}

function buildPatrolTbmText(rec, insufficientItems) {
  const lines = [];
  lines.push('[전주 순회점검 TBM 공유자료]');
  lines.push('매장: ' + (rec.storeName || ''));
  lines.push('점검주차: ' + (rec.weekLabel || rec.weekKey || ''));
  lines.push('제출상태: ' + (rec.submitStatus || ''));
  lines.push('');
  if (!insufficientItems.length) {
    lines.push('전주 점검결과 미흡사항은 없습니다.');
    lines.push('이번 주에도 통로 확보, 창고 정리정돈, 전기·소방 상태를 유지해주세요.');
  } else {
    lines.push('주요 미흡사항');
    insufficientItems.forEach(function (item, index) {
      lines.push((index + 1) + '. ' + (item.title || ''));
      lines.push('- 미흡내용: ' + (item.note || '미흡내용 확인 필요'));
      lines.push('- 공유사항: 동일 위험요인이 반복되지 않도록 작업 전 확인 바랍니다.');
    });
  }
  return lines.join('\n');
}

function copyTextToClipboard(text) {
  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(text).then(function () {
      showSubmitModal({ type: 'success', title: '복사 완료', html: 'TBM 공유문구가 복사되었습니다.', confirmText: '확인' });
    }).catch(function () { fallbackCopyText(text); });
  } else {
    fallbackCopyText(text);
  }
}

function fallbackCopyText(text) {
  const ta = document.createElement('textarea');
  ta.value = text;
  ta.style.position = 'fixed';
  ta.style.left = '-9999px';
  document.body.appendChild(ta);
  ta.focus();
  ta.select();
  try { document.execCommand('copy'); } catch (err) {}
  document.body.removeChild(ta);
  showSubmitModal({ type: 'success', title: '복사 완료', html: 'TBM 공유문구가 복사되었습니다.', confirmText: '확인' });
}

function setPatrolResult(type, msg) {
  const result = document.getElementById('patrolResultMessage');
  if (!result) return;
  result.className = 'result ' + (type || '');
  result.innerHTML = msg || '';
}

function resetPatrolFormAfterSuccess() {
  const formEl = document.getElementById('patrolForm');
  if (formEl) formEl.reset();
  patrolSelectedFiles = {};
  document.querySelectorAll('[data-patrol-preview]').forEach(function (span) { span.textContent = ''; });
  document.querySelectorAll('#patrolModule .preview-row').forEach(function (row) { row.classList.remove('active'); });
  document.querySelectorAll('[data-patrol-item-note]').forEach(function (textarea) { textarea.value = ''; });
  PATROL_ITEMS.forEach(function (item) { const good = document.querySelector('input[name="' + item.id + '_result"][value="양호"]'); if (good) good.checked = true; applyPatrolItemState(item.id); });
  clearPatrolSignature();
  clearPatrolAppointment();
  populatePatrolHeadquarters();
  updatePatrolWeekInfo();
  setPatrolResult('', '');
}