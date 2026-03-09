import api from "@/lib/api";

export const getCategories = async () => {
  const res = await api.get("/categories");
  // console.log("getting all the categories", res.data.data)
  return res.data.data;
};

export const createCategory = async (payload: any) => {
  const res = await api.post("/categories", payload);
  return res.data.data;
};

export const updateCategory = async (id: string, payload: any) => {
  const res = await api.put(`/categories/${id}`, payload);
  return res.data.data;
};

export const deleteCategory = async (id: string) => {
  const res = await api.delete(`/categories/${id}`);
  return res.data.data;
};