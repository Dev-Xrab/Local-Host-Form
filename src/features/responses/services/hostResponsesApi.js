async function request(path) {
  const res = await fetch(path);
  if (!res.ok) {
    let message = `Request failed (${res.status})`;
    try {
      const body = await res.json();
      if (body?.error) message = body.error;
    } catch {
      // response had no JSON body
    }
    const error = new Error(message);
    error.status = res.status;
    throw error;
  }
  return res.json();
}

export const hostResponsesApi = {
  listForForm: (formId) => request(`/api/forms/${formId}/responses`),
};
