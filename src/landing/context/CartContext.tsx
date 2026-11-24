'use client';
import React, { createContext, useContext, useEffect, useState } from 'react';

type Course = {
  id: string | number;
  name: string;
  price: number;
  lms_course_id: string;
  image?: string;
  isBundle?: boolean;
  bundleCourses?: { courseId: string; courseId2?: string | null; courseId3?: string | null; courseName: string }[];
};

type CartContextType = {
  cart: Course[];
  addToCart: (course: Course) => void;
  buyNow: (course: Course) => void;
  removeFromCart: (courseId: string | number) => void;
  clearCart: () => void;
  total: number;
};

const CartContext = createContext<CartContextType | undefined>(undefined);

export function CartProvider({ children }: { children: React.ReactNode }) {
  const [cart, setCart] = useState<Course[]>([]);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    try {
      const saved = localStorage.getItem('cart');
      if (saved) setCart(JSON.parse(saved));
    } catch {}
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    try { localStorage.setItem('cart', JSON.stringify(cart)); } catch {}
  }, [cart, hydrated]);

  const addToCart = (course: Course) => {
    if (!cart.some((c) => String(c.id) === String(course.id))) {
      setCart((prev) => [...prev, course]);
    }
  };

  const buyNow = (course: Course) => {
    addToCart(course);
    window.location.href = '/cart';
  };

  const removeFromCart = (courseId: string | number) => {
    setCart((prev) => prev.filter((c) => String(c.id) !== String(courseId)));
  };

  const clearCart = () => setCart([]);

  const total = cart.reduce((sum, item) => sum + item.price, 0);

  return (
    <CartContext.Provider value={{ cart, addToCart, buyNow, removeFromCart, clearCart, total }}>
      {children}
    </CartContext.Provider>
  );
}

export const useCart = () => {
  const context = useContext(CartContext);
  if (context === undefined) {
    throw new Error('useCart must be used within a CartProvider');
  }
  return context;
};
