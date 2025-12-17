export interface Word {
    id: string;
    word: string;
    pos: string;
    pronunciation: string;
    example: string;
    translation: string;
    unit: string;
    section: string;
}

export interface TestResult {
    date: number;
    deviceId?: string; // Anonymous device identifier
    type: 'cz-en-choice' | 'en-cz-choice' | 'cz-en-type' | 'en-cz-type';
    score: number; // calculated score
    total: number;
    mistakes: string[]; // IDs of mistakes
}

export interface VocabularyStructure {
    unit: string;
    sections: string[];
}
