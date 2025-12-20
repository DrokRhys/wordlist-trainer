import axios from 'axios';
import type { VocabularyStructure, Word, TestResult } from '../types';

import { getDeviceId } from '../utils/identity';

// Always use relative path, Vite proxy handles dev, Express handles prod
const API_URL = '/api';

export const api = {
    getLanguages: async () => {
        const res = await axios.get<string[]>(`${API_URL}/languages`);
        return res.data;
    },
    getStructure: async (lang?: string) => {
        const res = await axios.get<VocabularyStructure[]>(`${API_URL}/structure`, { params: { lang } });
        return res.data;
    },
    getWords: async (params: { unit?: string, section?: string, limit?: number, random?: boolean, prioritizeMistakes?: boolean, lang?: string }) => {
        const res = await axios.get<Word[]>(`${API_URL}/words`, { params });
        return res.data;
    },
    saveHistory: async (result: Omit<TestResult, 'date' | 'deviceId'>) => {
        const res = await axios.post(`${API_URL}/history`, {
            ...result,
            deviceId: getDeviceId(),
            date: Date.now()
        });
        return res.data;
    },
    getHistory: async () => {
        const res = await axios.get<any[]>(`${API_URL}/history`);
        return res.data;
    }
};
