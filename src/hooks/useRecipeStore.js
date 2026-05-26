import { useCallback } from 'react';
import { useLocalStore } from './useLocalStore.js';

/**
 * Persisted recipe store. Each recipe is a menu item name plus a bill of
 * materials (BOM) — a list of ingredients with portion size and waste %.
 *
 * Recipe shape:
 *   {
 *     id: string,
 *     name: string,
 *     targetFoodCostPct: number,   // default 30
 *     sellPrice: string,           // actual sell price (empty = not set)
 *     ingredients: [
 *       { _uid, name, unit, unitCost, portionSize, wastePct }
 *     ]
 *   }
 */
export function useRecipeStore() {
  const [recipes, setRecipes] = useLocalStore('recipes', { version: 1, initial: [] });

  const addRecipe = useCallback((name) => {
    const id = `r-${Date.now()}`;
    setRecipes(prev => [...prev, {
      id,
      name: name.trim(),
      targetFoodCostPct: 30,
      sellPrice: '',
      ingredients: [],
    }]);
    return id;
  }, [setRecipes]);

  const updateRecipe = useCallback((id, patch) => {
    setRecipes(prev => prev.map(r => r.id === id ? { ...r, ...patch } : r));
  }, [setRecipes]);

  const removeRecipe = useCallback((id) => {
    setRecipes(prev => prev.filter(r => r.id !== id));
  }, [setRecipes]);

  const addIngredient = useCallback((recipeId) => {
    const uid = `i-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    setRecipes(prev => prev.map(r => {
      if (r.id !== recipeId) return r;
      return {
        ...r,
        ingredients: [...r.ingredients, { _uid: uid, name: '', unit: '', unitCost: '', portionSize: '', wastePct: '' }],
      };
    }));
  }, [setRecipes]);

  const updateIngredient = useCallback((recipeId, uid, patch) => {
    setRecipes(prev => prev.map(r => {
      if (r.id !== recipeId) return r;
      return { ...r, ingredients: r.ingredients.map(i => i._uid === uid ? { ...i, ...patch } : i) };
    }));
  }, [setRecipes]);

  const removeIngredient = useCallback((recipeId, uid) => {
    setRecipes(prev => prev.map(r => {
      if (r.id !== recipeId) return r;
      return { ...r, ingredients: r.ingredients.filter(i => i._uid !== uid) };
    }));
  }, [setRecipes]);

  const clearAll = useCallback(() => setRecipes([]), [setRecipes]);

  return { recipes, addRecipe, updateRecipe, removeRecipe, addIngredient, updateIngredient, removeIngredient, clearAll };
}
