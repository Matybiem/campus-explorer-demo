import { useRef } from 'react'
import { Icon } from './icons'
import SpaceIcon from './SpaceIcon'
import { getSpaceColorClass, spaceCategories, type SpaceCategory } from './types'

type SpaceCategoryPickerProps = {
  value: SpaceCategory | null
  disabled: boolean
  onChange: (category: SpaceCategory) => void
}

function SpaceCategoryPicker({ value, disabled, onChange }: SpaceCategoryPickerProps) {
  const dropdownRef = useRef<HTMLDetailsElement>(null)

  return (
    <details ref={dropdownRef} className="category-picker">
      <summary
        className={`category-picker-summary${value ? ` ${getSpaceColorClass('Espacio común', value)}` : ''}`}
        aria-disabled={disabled}
        onClick={(event) => {
          if (disabled) event.preventDefault()
        }}
      >
        {value ? <SpaceIcon type="Espacio común" category={value} /> : <span className="category-picker-placeholder"><Icon name="question-mark" /></span>}
        <span>{value ?? 'Selecciona una categoría'}</span>
        <span className="category-picker-chevron" aria-hidden="true"><Icon name="chevron-down" /></span>
      </summary>
      <div className="category-picker-options">
        {spaceCategories.map((category) => (
          <button
            key={category}
            type="button"
            className={`category-picker-option ${getSpaceColorClass('Espacio común', category)}${value === category ? ' is-selected' : ''}`}
            disabled={disabled}
            onClick={() => {
              onChange(category)
              if (dropdownRef.current) dropdownRef.current.open = false
            }}
          >
            <SpaceIcon type="Espacio común" category={category} />
            <span>{category}</span>
            {value === category && <span className="category-picker-check" aria-hidden="true"><Icon name="check" /></span>}
          </button>
        ))}
      </div>
    </details>
  )
}

export default SpaceCategoryPicker
