// Lê a URL do backend configurada na Vercel (ou usa o Render como fallback)
const API_URL = import.meta.env.VITE_API_URL || 'https://agenda-pro-hair-api.onrender.com';

// Classe de Erro personalizada exportada para format.ts e PublicBooking.tsx
export class ApiError extends Error {
  status: number;
  data: any;
  body: any;

  constructor(message: string, status: number, data?: any) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.data = data;
    this.body = data;
  }
}

// Helper genérico para requisições com fetch
async function request<T = any>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const token = localStorage.getItem('token') || sessionStorage.getItem('token');
  
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string> || {}),
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const url = endpoint.startsWith('http') ? endpoint : `${API_URL}${endpoint.startsWith('/') ? '' : '/'}${endpoint}`;

  const response = await fetch(url, {
    ...options,
    headers,
  });

  let responseData: any;
  const contentType = response.headers.get('content-type');
  if (contentType && contentType.includes('application/json')) {
    responseData = await response.json();
  } else {
    responseData = await response.text();
  }

  if (!response.ok) {
    const errorMessage = typeof responseData === 'object' && responseData?.detail 
      ? responseData.detail 
      : `Erro na requisição (${response.status})`;
    throw new ApiError(errorMessage, response.status, responseData);
  }

  return responseData as T;
}

// Helpers exportados com extração inteligente para evitar falhas de .map()
export const apiGet = async <T = any>(url: string, config?: RequestInit): Promise<T> => {
  const data = await request<any>(url, { method: 'GET', ...config });
  
  // Se a resposta for um objeto que contém propriedades de array conhecidas, desinibe e retorna o array
  if (data && typeof data === 'object' && !Array.isArray(data)) {
    if (Array.isArray(data.data)) return data.data as T;
    if (Array.isArray(data.items)) return data.items as T;
    if (Array.isArray(data.salons)) return data.salons as T;
    if (Array.isArray(data.services)) return data.services as T;
    if (Array.isArray(data.team)) return data.team as T;
    if (Array.isArray(data.appointments)) return data.appointments as T;
  }

  return data as T;
};

export const apiPost = <T = any>(url: string, data?: any, config?: RequestInit): Promise<T> => 
  request<T>(url, { method: 'POST', body: data ? JSON.stringify(data) : undefined, ...config });

export const apiPut = <T = any>(url: string, data?: any, config?: RequestInit): Promise<T> => 
  request<T>(url, { method: 'PUT', body: data ? JSON.stringify(data) : undefined, ...config });

export const apiPatch = <T = any>(url: string, data?: any, config?: RequestInit): Promise<T> => 
  request<T>(url, { method: 'PATCH', body: data ? JSON.stringify(data) : undefined, ...config });

export const apiDelete = <T = any>(url: string, config?: RequestInit): Promise<T> => 
  request<T>(url, { method: 'DELETE', ...config });

// Objeto de compatibilidade api.get, api.post, etc.
export const api = {
  get: apiGet,
  post: apiPost,
  put: apiPut,
  patch: apiPatch,
  delete: apiDelete,
};

export default api;
