import { useState } from 'react';
import { useLang } from '../../i18n/LangContext.jsx';
import { formatCurrency } from '@utils/helpers';
import './RecipeTab.css';

function lineCost(ing) {
  const u = parseFloat(ing.unitCost) || 0;
  const p = parseFloat(ing.portionSize) || 0;
  const w = parseFloat(ing.wastePct) || 0;
  return u * p * (1 + w / 100);
}

function plateCost(recipe) {
  return recipe.ingredients.reduce((s, ing) => s + lineCost(ing), 0);
}

export default function RecipeTab({
  recipes,
  addRecipe,
  updateRecipe,
  removeRecipe,
  addIngredient,
  updateIngredient,
  removeIngredient,
  ingredientSuggestions = [],
}) {
  const { t } = useLang();
  const [activeId, setActiveId] = useState(null);
  const [newName, setNewName] = useState('');

  const handleAddRecipe = () => {
    const name = newName.trim();
    if (!name) return;
    const id = addRecipe(name);
    setActiveId(id);
    setNewName('');
  };

  // When an ingredient name field blurs, auto-fill unitCost from imports if
  // the name matches a suggestion and unitCost is still empty.
  const handleNameBlur = (recipe, uid) => {
    const ing = recipe.ingredients.find(i => i._uid === uid);
    if (!ing || ing.unitCost) return;
    const match = ingredientSuggestions.find(
      s => s.name.toLowerCase() === ing.name.toLowerCase().trim()
    );
    if (match) {
      updateIngredient(recipe.id, uid, { unitCost: String(Math.round(match.unitCost * 100) / 100) });
    }
  };

  return (
    <div className="rc-tab">
      <h2 className="page-title">{t.recipeTitle || 'Recipe Costing'}</h2>
      <p className="rc-sub">
        {t.recipeSub || 'Build a bill of materials for each menu item. Plate cost and suggested sell price are calculated automatically.'}
      </p>

      {/* ── NEW RECIPE FORM ── */}
      <div className="rc-new-form">
        <input
          className="form-input"
          placeholder={t.recipeNewPlaceholder || 'Recipe name (e.g. Tacos, Sliders)'}
          value={newName}
          onChange={e => setNewName(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && handleAddRecipe()}
        />
        <button
          className="btn btn-primary btn-sm"
          onClick={handleAddRecipe}
          disabled={!newName.trim()}
        >
          {t.recipeAddBtn || 'Add Recipe'}
        </button>
      </div>

      {/* Datalist for ingredient name autocomplete from food cost imports */}
      <datalist id="rc-ingredient-list">
        {ingredientSuggestions.map(s => <option key={s.name} value={s.name} />)}
      </datalist>

      {/* ── RECIPE LIST ── */}
      {recipes.length === 0 ? (
        <div className="rc-empty">
          {t.recipeEmpty || 'No recipes yet. Add one above to get started.'}
        </div>
      ) : (
        <div className="rc-list">
          {recipes.map(recipe => {
            const plate  = plateCost(recipe);
            const target = parseFloat(recipe.targetFoodCostPct) || 30;
            const sell   = parseFloat(recipe.sellPrice) || 0;
            const suggested  = plate > 0 && target > 0 ? plate / (target / 100) : 0;
            const actualPct  = sell > 0 && plate > 0 ? (plate / sell) * 100 : null;
            const isOpen = activeId === recipe.id;

            return (
              <div key={recipe.id} className={`rc-card ${isOpen ? 'open' : ''}`}>

                {/* ── Card header ── */}
                <div
                  className="rc-card-header"
                  role="button"
                  tabIndex={0}
                  aria-expanded={isOpen}
                  onClick={() => setActiveId(isOpen ? null : recipe.id)}
                  onKeyDown={e => (e.key === 'Enter' || e.key === ' ') && setActiveId(isOpen ? null : recipe.id)}
                >
                  <span className="rc-card-name">{recipe.name}</span>
                  <div className="rc-card-meta">
                    <span className="rc-card-count">
                      {recipe.ingredients.length} {t.recipeIngredients || 'ingredients'}
                    </span>
                    {plate > 0 && (
                      <span className="rc-plate-badge">
                        {formatCurrency(plate)} {t.recipePlateCostShort || 'plate'}
                      </span>
                    )}
                  </div>
                  <div className="rc-card-actions" onClick={e => e.stopPropagation()}>
                    <button
                      className="btn-remove"
                      title={t.recipeDeleteRecipe || 'Delete recipe'}
                      aria-label={t.recipeDeleteRecipe || 'Delete recipe'}
                      onClick={() => { removeRecipe(recipe.id); if (activeId === recipe.id) setActiveId(null); }}
                    >×</button>
                    <span className="rc-chevron" aria-hidden="true">{isOpen ? '▲' : '▼'}</span>
                  </div>
                </div>

                {/* ── Card body ── */}
                {isOpen && (
                  <div className="rc-card-body">

                    {/* Settings */}
                    <div className="rc-settings">
                      <label className="rc-setting-label">
                        <span className="rc-setting-text">{t.recipeTargetPct || 'Target food cost %'}</span>
                        <div className="target-input-wrap">
                          <input
                            className="form-input form-input-sm"
                            type="number" min="1" max="100" step="0.5"
                            value={recipe.targetFoodCostPct}
                            onChange={e => updateRecipe(recipe.id, { targetFoodCostPct: e.target.value })}
                          />
                          <span className="target-suffix">%</span>
                        </div>
                      </label>
                      <label className="rc-setting-label">
                        <span className="rc-setting-text">{t.recipeSellPrice || 'Actual sell price'}</span>
                        <div className="target-input-wrap">
                          <span className="target-prefix">$</span>
                          <input
                            className="form-input form-input-sm"
                            type="number" min="0" step="0.01"
                            placeholder="0.00"
                            value={recipe.sellPrice}
                            onChange={e => updateRecipe(recipe.id, { sellPrice: e.target.value })}
                          />
                        </div>
                      </label>
                    </div>

                    {/* Ingredient table */}
                    <div className="rc-table-wrap">
                      <table className="rc-table">
                        <thead>
                          <tr>
                            <th>{t.recipeColIngredient || 'Ingredient'}</th>
                            <th>{t.recipeColUnit || 'Unit'}</th>
                            <th>{t.recipeColUnitCost || '$/unit'}</th>
                            <th>{t.recipeColPortion || 'Portion'}</th>
                            <th>{t.recipeColWaste || 'Waste %'}</th>
                            <th>{t.recipeColLineCost || 'Cost'}</th>
                            <th />
                          </tr>
                        </thead>
                        <tbody>
                          {recipe.ingredients.length === 0 ? (
                            <tr>
                              <td colSpan={7} className="rc-table-empty">
                                {t.recipeNoIngredients || 'No ingredients yet. Add one below.'}
                              </td>
                            </tr>
                          ) : (
                            recipe.ingredients.map(ing => {
                              const cost = lineCost(ing);
                              return (
                                <tr key={ing._uid}>
                                  <td>
                                    <input
                                      className="form-input form-input-sm"
                                      list="rc-ingredient-list"
                                      placeholder={t.recipeIngredientPlaceholder || 'e.g. Ground beef'}
                                      value={ing.name}
                                      onChange={e => updateIngredient(recipe.id, ing._uid, { name: e.target.value })}
                                      onBlur={() => handleNameBlur(recipe, ing._uid)}
                                    />
                                  </td>
                                  <td>
                                    <input
                                      className="form-input form-input-sm"
                                      placeholder="oz"
                                      value={ing.unit}
                                      onChange={e => updateIngredient(recipe.id, ing._uid, { unit: e.target.value })}
                                    />
                                  </td>
                                  <td>
                                    <div className="target-input-wrap">
                                      <span className="target-prefix">$</span>
                                      <input
                                        className="form-input form-input-sm"
                                        type="number" min="0" step="0.001"
                                        placeholder="0.00"
                                        value={ing.unitCost}
                                        onChange={e => updateIngredient(recipe.id, ing._uid, { unitCost: e.target.value })}
                                      />
                                    </div>
                                  </td>
                                  <td>
                                    <input
                                      className="form-input form-input-sm"
                                      type="number" min="0" step="0.01"
                                      placeholder="0"
                                      value={ing.portionSize}
                                      onChange={e => updateIngredient(recipe.id, ing._uid, { portionSize: e.target.value })}
                                    />
                                  </td>
                                  <td>
                                    <div className="target-input-wrap">
                                      <input
                                        className="form-input form-input-sm"
                                        type="number" min="0" max="100" step="0.5"
                                        placeholder="0"
                                        value={ing.wastePct}
                                        onChange={e => updateIngredient(recipe.id, ing._uid, { wastePct: e.target.value })}
                                      />
                                      <span className="target-suffix">%</span>
                                    </div>
                                  </td>
                                  <td className="rc-line-cost">
                                    {cost > 0 ? formatCurrency(cost) : '—'}
                                  </td>
                                  <td>
                                    <button
                                      className="btn-remove"
                                      title={t.recipeRemoveIngredient || 'Remove'}
                                      aria-label={t.recipeRemoveIngredient || 'Remove ingredient'}
                                      onClick={() => removeIngredient(recipe.id, ing._uid)}
                                    >×</button>
                                  </td>
                                </tr>
                              );
                            })
                          )}
                        </tbody>
                      </table>
                    </div>

                    <button
                      className="btn btn-ghost btn-sm rc-add-ing-btn"
                      onClick={() => addIngredient(recipe.id)}
                    >
                      + {t.recipeAddIngredient || 'Add Ingredient'}
                    </button>

                    {/* ── Summary ── */}
                    {plate > 0 && (
                      <div className="rc-summary">
                        <div className="rc-summary-row">
                          <span>{t.recipePlateCost || 'Plate cost'}</span>
                          <strong>{formatCurrency(plate)}</strong>
                        </div>
                        {suggested > 0 && (
                          <div className="rc-summary-row">
                            <span>
                              {t.recipeSuggestedPrice || 'Suggested sell price'}
                              <span className="rc-summary-hint"> ({target}% {t.recipeAtTarget || 'target'})</span>
                            </span>
                            <strong>{formatCurrency(suggested)}</strong>
                          </div>
                        )}
                        {actualPct !== null && (
                          <div className={`rc-summary-row rc-summary-pct ${actualPct <= target ? 'good' : actualPct <= target * 1.1 ? 'warn' : 'bad'}`}>
                            <span>{t.recipeFoodCostPct || 'Actual food cost %'}</span>
                            <strong>{actualPct.toFixed(1)}%</strong>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
