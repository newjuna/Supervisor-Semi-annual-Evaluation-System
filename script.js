/**
 * 관리감독자 반기 업무수행 평가 시스템 - GitHub Pages용 script.js
 *
 * 핵심 구조
 * - 화면: GitHub Pages
 * - 조직도: Google Sheets '조직도' 시트 A:D를 Apps Script에서 불러옴
 * - 저장: Apps Script → Google Sheets DB
 * - 사진: Google Drive 미사용, Google Sheets 내부 _FILE_INDEX / _FILE_CHUNKS 시트에 압축 저장
 *
 * 사용 전 반드시 아래 APPS_SCRIPT_URL을 본인의 Apps Script 웹앱 URL로 변경하세요.
 */
const APPS_SCRIPT_URL = '여기에_Apps_Script_웹앱_URL을_붙여넣으세요';

const EVALUATION_ITEMS = [
  {
    id: 'q01',
    title: '매장 내 기계·기구 및 설비의 안전·보건 점검',
    desc: '리프트, 승강기, 소방설비 등 기계·기구 및 설비의 점검·유지보수 이력 확인'
  },
  {
    id: 'q02',
    title: '매장 근로자들의 작업복·보호구 및 방호장치 점검과 교육',
    desc: '안전모, 장갑 등 보호구 착용·사용 지도 및 교육 실시 여부'
  },
  {
    id: 'q03',
    title: '매장 산업재해 보고 및 응급조치 활동',
    desc: '산업재해 발생 시 보고, 응급조치, 산업재해조사표 작성 등 이행 여부'
  },
  {
    id: 'q04',
    title: '매장 정리정돈 및 통로 확보 감독',
    desc: '순회점검일지 작성, 통로·비상통로 확보, 후방공간 정리정돈 확인'
  },
  {
    id: 'q05',
    title: '안전보건관리자 등의 지도·조언에 대한 협조',
    desc: '안전보건팀 점검, 개선요청, 지도·조언 사항에 대한 협조 및 조치'
  },
  {
    id: 'q06',
    title: '매장 위험성평가 참여 및 개선조치 시행',
    desc: '정기·수시 위험성평가 참여, 유해·위험요인 개선조치 이행'
  },
  {
    id: 'q07',
    title: '매장 비상상황 발생에 대한 대응능력',
    desc: '비상대응훈련 실시, 비상연락체계 확인, 대피 및 초기대응 역량 확보'
  },
  {
    id: 'q08',
    title: '매장 업무 시작 전 안전한 작업환경 조성',
    desc: '작업 전 안전교육, TBM, 건강상태 확인, 위험요인 전파 등'
  },
  {
    id: 'q09',
    title: '안전보건교육 참여 및 지원',
    desc: '관리감독자교육, 정기안전보건교육, 신규입사자교육 참여·지원·독려'
  },
  {
    id: 'q10',
    title: '법규 및 지침 준수 여부',
    desc: '안전보건 사내규정, 지침, 공지사항 등 확인 및 준수'
  }
];

const FILE_FIELDS = [
  { name: 'file_equipment', label: '기계·기구 및 설비 점검 / 유지보수 이력' },
  { name: 'file_riskAssessment', label: '위험성평가 자료' },
  { name: 'file_emergencyTraining', label: '비상대응훈련 자료' },
  { name: 'file_ppeRegister', label: '안전보호구 지급대장' },
  { name: 'file_patrolLog', label: '순회점검일지' },
  { name: 'file_accidentReport', label: '산업재해조사표 또는 수시위험성평가 자료' }
];

let orgTree = {};

const form = document.getElementById('evaluationForm');
const submitBtn = document.getElementById('submitBtn');
const resultMessage = document.getElementById('resultMessage');
const evaluationItemsContainer = document.getElementById('evaluationItems');

const orgLoadMessage = document.getElementById('orgLoadMessage');
const headquarterSelect = document.getElementById('headquarterSelect');
const departmentSelect = document.getElementById('departmentSelect');
const teamSelect = document.getElementById('teamSelect');
const storeSelect = document.getElementById('storeSelect');
const accidentOccurredSelect = document.getElementById('accidentOccurred');
const accidentReportFile = document.getElementById('accidentReportFile');
const accidentFileLabel = document.getElementById('accidentFileLabel');

document.addEventListener('DOMContentLoaded', function () {
  renderEvaluationItems();
  bindCascadingOrgSelects();
  bindAccidentFileRule();
  loadOrganizationTree();
});

form.addEventListener('submit', async function (event) {
  event.preventDefault();

  if (!validateAppsScriptUrl()) return;
  if (!validateOrganizationLoaded()) return;
  if (!validateInsufficientReasons()) return;
  if (!validateAccidentAttachment()) return;

  setResult('pending', '제출 준비 중입니다. 사진 압축 및 저장 준비 중입니다.');
  submitBtn.disabled = true;
  submitBtn.textContent = '제출 중입니다...';

  try {
    const payload = await buildPayload();

    setResult('pending', '자료를 전송 중입니다. 창을 닫지 말고 기다려주세요.');
    await postPayloadByHiddenForm(payload);

    setResult('pending', '자료가 전송되었습니다. 저장 완료 여부를 확인 중입니다...');
    const status = await waitForSaveStatus(payload.submissionId);

    if (status && status.success) {
      setResult(
        'success',
        `제출 완료되었습니다.<br>제출자: ${escapeHtml(payload.basic.supervisorName)} / 자동점수: ${status.score || payload.score}점`
      );
      form.reset();
      resetOrgSelectsAfterSubmit();
      bindAccidentFileRule();
    } else {
      throw new Error(status && status.message ? status.message : '저장 상태 확인 실패');
    }
  } catch (error) {
    console.error(error);
    setResult('error', '제출 중 오류가 발생했습니다.<br>' + escapeHtml(error.message));
  } finally {
    submitBtn.disabled = false;
    submitBtn.textContent = '반기평가 제출하기';
  }
});

function renderEvaluationItems() {
  evaluationItemsContainer.innerHTML = EVALUATION_ITEMS.map(function (item, index) {
    return `
      <div class="check-item" data-item="${item.id}">
        <div class="item-title">${index + 1}. ${escapeHtml(item.title)}</div>
        <p class="item-desc">${escapeHtml(item.desc)}</p>

        <div class="radio-group" role="radiogroup" aria-label="${escapeHtml(item.title)} 평가결과">
          <label><input type="radio" name="${item.id}_result" value="양호" required /> 양호</label>
          <label><input type="radio" name="${item.id}_result" value="미흡" /> 미흡</label>
          <label><input type="radio" name="${item.id}_result" value="N/A" /> N/A</label>
        </div>

        <div class="detail-grid">
          <label>
            실행내역 <span class="required-mark">*</span>
            <textarea name="${item.id}_action" rows="3" placeholder="예: 상반기 위험성평가 완료, 순회점검일지 확인 등" required></textarea>
          </label>

          <label>
            미흡사유
            <textarea name="${item.id}_reason" rows="3" placeholder="미흡 선택 시 사유를 작성해주세요."></textarea>
          </label>
        </div>
      </div>
    `;
  }).join('');
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

function bindAccidentFileRule() {
  applyAccidentFileRule();
  accidentOccurredSelect.onchange = applyAccidentFileRule;
}

function applyAccidentFileRule() {
  const occurred = accidentOccurredSelect.value === '있음';
  accidentReportFile.disabled = !occurred;
  accidentReportFile.required = occurred;
  accidentFileLabel.classList.toggle('conditional-disabled', !occurred);

  if (!occurred) {
    accidentReportFile.value = '';
  }
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
    employeeId: normalizeText(formData.get('employeeId') || ''),
    accidentOccurred: formData.get('accidentOccurred') || '',
    overallComment: formData.get('overallComment') || ''
  };

  const items = EVALUATION_ITEMS.map(function (item, index) {
    return {
      no: index + 1,
      id: item.id,
      title: item.title,
      result: formData.get(`${item.id}_result`) || '',
      action: formData.get(`${item.id}_action`) || '',
      reason: formData.get(`${item.id}_reason`) || ''
    };
  });

  const scoreInfo = calculateScore(items);
  const attachments = await collectAttachments(formData, submissionId);

  return {
    submissionId: submissionId,
    submittedAtClient: new Date().toISOString(),
    userAgent: navigator.userAgent,
    basic: basic,
    items: items,
    attachments: attachments,
    score: scoreInfo.score,
    goodCount: scoreInfo.goodCount,
    insufficientCount: scoreInfo.insufficientCount,
    naCount: scoreInfo.naCount,
    applicableCount: scoreInfo.applicableCount
  };
}

async function collectAttachments(formData, submissionId) {
  const attachments = [];

  for (const field of FILE_FIELDS) {
    const file = formData.get(field.name);

    if (!file || !file.name) {
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

  let dataUrl = await resizeImageToDataUrl(file, 900, 0.55);

  // 구글시트 저장 안정성을 위해 너무 큰 이미지는 한 번 더 축소합니다.
  if (dataUrl.length > 220000) {
    dataUrl = await resizeImageToDataUrl(file, 700, 0.45);
  }

  if (dataUrl.length > 320000) {
    throw new Error(`${file.name} 사진 용량이 너무 큽니다. 조금 더 멀리서 촬영하지 말고, 문서 부분만 나오게 다시 촬영해주세요.`);
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
  let goodCount = 0;
  let insufficientCount = 0;
  let naCount = 0;

  items.forEach(function (item) {
    if (item.result === '양호') goodCount += 1;
    if (item.result === '미흡') insufficientCount += 1;
    if (item.result === 'N/A') naCount += 1;
  });

  const applicableCount = items.length - naCount;
  const score = applicableCount === 0 ? 0 : Math.round((goodCount / applicableCount) * 1000) / 10;

  return { score, goodCount, insufficientCount, naCount, applicableCount };
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
    }, 70000);

    iframe.onload = function () {
      if (!submitted) return;
      clearTimeout(timer);
      // 실제 저장 성공 여부는 status polling에서 확인합니다.
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
  const timeoutMs = 90000;
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

function validateInsufficientReasons() {
  for (const item of EVALUATION_ITEMS) {
    const result = form.querySelector(`input[name="${item.id}_result"]:checked`);
    const reason = form.querySelector(`textarea[name="${item.id}_reason"]`);

    if (result && result.value === '미흡' && reason && reason.value.trim() === '') {
      reason.focus();
      setResult('error', `"${item.title}" 항목이 미흡인 경우 미흡사유를 작성해야 합니다.`);
      return false;
    }
  }

  return true;
}

function validateAccidentAttachment() {
  if (accidentOccurredSelect.value === '있음' && !accidentReportFile.files.length) {
    setResult('error', '산업재해 발생 여부를 “있음”으로 선택한 경우 산업재해조사표 또는 수시위험성평가 자료를 첨부해야 합니다.');
    accidentReportFile.focus();
    return false;
  }
  return true;
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
