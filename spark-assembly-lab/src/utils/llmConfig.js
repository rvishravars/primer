// Central configuration for LLM vendor selection and API key storage.

const VENDORS = [
  {
    id: 'codex',
    label: 'Codex (OpenAI)',
    description: 'Code-focused OpenAI model via backend proxy',
    backendProvider: 'openai',
    defaultModel: 'gpt-4o-mini',
    models: [
      { id: 'gpt-4o-mini', label: 'gpt-4o-mini (fast, cheap)' },
      { id: 'gpt-4o', label: 'gpt-4o (higher quality)' },
    ],
  },
  {
    id: 'claude-code',
    label: 'Claude Code (Anthropic)',
    description: 'Code-focused Claude model via backend proxy',
    backendProvider: 'anthropic',
    defaultModel: 'claude-3.5-sonnet',
    models: [
      { id: 'claude-3.5-sonnet', label: 'Claude 3.5 Sonnet (balanced)' },
      { id: 'claude-3.5-haiku', label: 'Claude 3.5 Haiku (fast)' },
    ],
  },
];

const STORAGE_KEYS = {
  activeVendor: 'spark_lab_llm_vendor',
  apiKeyPrefix: 'spark_lab_llm_key_',
   modelPrefix: 'spark_lab_llm_model_',
};

export function getVendors() {
  return VENDORS;
}

export function getActiveVendorId() {
  try {
    return localStorage.getItem(STORAGE_KEYS.activeVendor) || 'codex';
  } catch (e) {
    console.error('Failed to load active LLM vendor:', e);
    return 'codex';
  }
}

export function setActiveVendorId(vendorId) {
  try {
    localStorage.setItem(STORAGE_KEYS.activeVendor, vendorId);
  } catch (e) {
    console.error('Failed to save active LLM vendor:', e);
  }
}

export function getVendorApiKey(vendorId) {
  try {
    return localStorage.getItem(STORAGE_KEYS.apiKeyPrefix + vendorId) || '';
  } catch (e) {
    console.error('Failed to load LLM API key:', e);
    return '';
  }
}

export function saveVendorApiKey(vendorId, apiKey) {
  try {
    if (apiKey) {
      localStorage.setItem(STORAGE_KEYS.apiKeyPrefix + vendorId, apiKey);
    } else {
      localStorage.removeItem(STORAGE_KEYS.apiKeyPrefix + vendorId);
    }
  } catch (e) {
    console.error('Failed to save LLM API key:', e);
  }
}

export function clearVendorApiKey(vendorId) {
  try {
    localStorage.removeItem(STORAGE_KEYS.apiKeyPrefix + vendorId);
  } catch (e) {
    console.error('Failed to clear LLM API key:', e);
  }
}

export function getActiveLlmConfig() {
  const vendorId = getActiveVendorId();
  const apiKey = getVendorApiKey(vendorId);
  const vendor = VENDORS.find((v) => v.id === vendorId) || VENDORS[0];
  const modelId = getSelectedModelForVendor(vendor.id);
  return { vendorId: vendor.id, vendor, apiKey, modelId };
}

export function getBackendConfigForVendor(vendorId) {
  const vendor = VENDORS.find((v) => v.id === vendorId) || VENDORS[0];
  const modelId = getSelectedModelForVendor(vendor.id);
  return {
    provider: vendor.backendProvider,
    model: modelId || vendor.defaultModel,
  };
}

export function getVendorModels(vendorId) {
  const vendor = VENDORS.find((v) => v.id === vendorId) || VENDORS[0];
  return vendor.models || [];
}

export function getSelectedModelForVendor(vendorId) {
  try {
    return localStorage.getItem(STORAGE_KEYS.modelPrefix + vendorId) || '';
  } catch (e) {
    console.error('Failed to load LLM model selection:', e);
    return '';
  }
}

export function saveSelectedModelForVendor(vendorId, modelId) {
  try {
    if (modelId) {
      localStorage.setItem(STORAGE_KEYS.modelPrefix + vendorId, modelId);
    } else {
      localStorage.removeItem(STORAGE_KEYS.modelPrefix + vendorId);
    }
  } catch (e) {
    console.error('Failed to save LLM model selection:', e);
  }
}
