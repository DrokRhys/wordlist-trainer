import axios from 'axios';
import type { VocabularyStructure, Word, TestResult } from '../types';

import { getDeviceId } from '../utils/identity';

const API_URL = 'http://localhost:3000/api';

export const api = {
    getStructure: async () => {
        const res = await axios.get<VocabularyStructure[]>(`${API_URL}/structure`);
        return res.data;
    },
    getWords: async (params: { unit?: string, section?: string, limit?: number, random?: boolean, prioritizeMistakes?: boolean }) => {
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
