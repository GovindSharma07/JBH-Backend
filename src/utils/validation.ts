// A simple validation utility. 
// For a production app, consider using a library like Joi or Zod.

export const validateEmail = (email: string): boolean => {
  const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return re.test(String(email).toLowerCase());
};

export const validatePhone = (phone: string): boolean => {
  // This is a basic example (e.g., 10 digits). 
  // You should use a more robust library for real phone validation.
  const re = /^\d{10}$/;
  return re.test(phone);
};

export const validatePassword = (password: string): boolean => {
  // Example: min 8 characters, 1 uppercase, 1 lowercase, 1 number
  const re = /^(?=.*\d)(?=.*[a-z])(?=.*[A-Z]).{8,}$/;
  return re.test(password);
};