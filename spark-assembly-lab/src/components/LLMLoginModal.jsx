import { useEffect, useState } from 'react';
import { Brain, Key, X } from 'lucide-react';
import {
  getVendors,
  getActiveVendorId,
  setActiveVendorId,
  getVendorApiKey,
  saveVendorApiKey,
  getVendorModels,
  getSelectedModelForVendor,
  saveSelectedModelForVendor,
} from '../utils/llmConfig';

export default function LLMLoginModal({ onClose }) {
  const vendors = getVendors();
  const [selectedVendor, setSelectedVendor] = useState(() => getActiveVendorId());
  const [apiKey, setApiKey] = useState('');
  const [rememberKey, setRememberKey] = useState(false);
  const [selectedModel, setSelectedModel] = useState('');

  useEffect(() => {
    const key = getVendorApiKey(selectedVendor);
    const model = getSelectedModelForVendor(selectedVendor);
    if (key) {
      setApiKey(key);
      setRememberKey(true);
    } else {
      setApiKey('');
      setRememberKey(false);
    }
    if (model) {
      setSelectedModel(model);
    } else {
      const models = getVendorModels(selectedVendor);
      setSelectedModel(models[0]?.id || '');
    }
  }, [selectedVendor]);

  const handleSave = () => {
    setActiveVendorId(selectedVendor);
    if (rememberKey) {
      saveVendorApiKey(selectedVendor, apiKey.trim());
    } else {
      saveVendorApiKey(selectedVendor, '');
    }
    saveSelectedModelForVendor(selectedVendor, selectedModel);
    onClose();
  };

  const activeVendor = vendors.find((v) => v.id === selectedVendor) || vendors[0];

  return (
    <div className="fixed inset-0 z-[75] flex items-center justify-center p-4 sm:p-6 theme-overlay backdrop-blur-md">
      <div className="w-full max-w-md rounded-3xl border-2 border-design-500 bg-black/90 shadow-[0_0_40px_-12px_rgba(56,189,248,0.6)] backdrop-blur-xl flex flex-col overflow-hidden">
        <div className="flex items-center justify-between px-5 sm:px-6 py-3 border-b border-white/10 bg-gradient-to-r from-design-900/70 via-black to-logic-900/70">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-2xl bg-design-500 shadow-[0_0_15px_rgba(56,189,248,0.8)]">
              <Brain className="h-5 w-5 text-black" />
            </div>
            <div>
              <h2 className="text-sm sm:text-base font-bold tracking-tight text-white">LLM Login</h2>
              <p className="text-[11px] text-white/70">Select your LLM vendor and API key.</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-full hover:bg-white/10 text-white/70 hover:text-white transition-colors"
            aria-label="Close LLM Login"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="px-5 sm:px-6 py-4 space-y-4 text-xs sm:text-sm text-white/80">
          <div>
            <p className="text-[11px] uppercase tracking-[0.18em] text-white/50 font-semibold mb-2">Vendor</p>
            <div className="flex flex-col gap-2">
              {vendors.map((vendor) => (
                <button
                  key={vendor.id}
                  type="button"
                  onClick={() => setSelectedVendor(vendor.id)}
                  className={`w-full text-left rounded-xl px-3 py-2 border text-xs sm:text-sm transition-all ${
                    selectedVendor === vendor.id
                      ? 'border-design-400 bg-design-500/15 text-white'
                      : 'border-white/15 hover:border-white/35 text-white/80 hover:text-white'
                  }`}
                >
                  <div className="font-semibold">{vendor.label}</div>
                  <div className="text-[11px] text-white/60 mt-0.5">{vendor.description}</div>
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between gap-2">
              <span className="inline-flex items-center gap-1 text-white/70">
                <Key className="h-3 w-3" />
                <span>API key for {activeVendor.label}</span>
              </span>
            </div>
            <input
              type="password"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              placeholder="Paste your API key"
              className="w-full rounded-lg bg-black/40 border border-white/20 px-2 py-1.5 text-xs sm:text-sm text-white placeholder:text-white/40 focus:outline-none focus:ring-1 focus:ring-design-400/70 focus:border-design-400/70"
            />
            <label className="flex items-center gap-2 text-[11px] text-white/60 cursor-pointer select-none">
              <input
                type="checkbox"
                className="h-3 w-3 rounded border-white/40 bg-black/40"
                checked={rememberKey}
                onChange={(e) => setRememberKey(e.target.checked)}
              />
              <span>Remember on this browser</span>
            </label>
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between gap-2">
              <span className="inline-flex items-center gap-1 text-white/70">
                <span>Model for {activeVendor.label}</span>
              </span>
            </div>
            <select
              value={selectedModel}
              onChange={(e) => setSelectedModel(e.target.value)}
              className="w-full rounded-lg bg-black/40 border border-white/20 px-2 py-1.5 text-xs sm:text-sm text-white focus:outline-none focus:ring-1 focus:ring-design-400/70 focus:border-design-400/70"
            >
              {getVendorModels(selectedVendor).map((model) => (
                <option key={model.id} value={model.id}>
                  {model.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="px-5 sm:px-6 py-3 border-t border-white/10 bg-black/80 flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="px-3 py-1.5 rounded-lg text-xs sm:text-sm theme-muted-hover"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={!apiKey.trim()}
            className="px-4 py-1.5 rounded-lg text-xs sm:text-sm bg-design-500 hover:bg-design-400 text-black font-semibold disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Save
          </button>
        </div>
      </div>
    </div>
  );
}
