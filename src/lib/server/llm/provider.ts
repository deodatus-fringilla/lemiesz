export interface ChatMessage {
	role: 'user' | 'assistant' | 'system';
	content: string;
}

export interface ChatRequest {
	messages: ChatMessage[];
	temperature?: number;
	maxTokens?: number;
	systemPrompt?: string;
}

export interface Token {
	text: string;
	done?: boolean;
}

export interface LlmProvider {
	readonly id: string;
	stream(req: ChatRequest): AsyncIterable<Token>;
	structured<T>(req: ChatRequest, schemaDescription: string): Promise<T>;
}
