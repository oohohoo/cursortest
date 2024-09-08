// Global variables
let customBreakpoints = {};
let pages = [
    { id: 'page1', name: 'Page 1', sections: [] }
];
let currentPage = pages[0];
let dragStartCell = null;
let dragEndCell = null;
let isResizing = false;
let isMoving = false;
let selectedArea = null;
let selectedSection = null;
let historyStack = [];
let historyIndex = -1;
let currentBreakpoint = 'desktop-large'; // Set initial breakpoint to 'desktop-large'
const MAX_HISTORY = 50; 

// DOM elements
const gridContainer = document.querySelector('.main-grid-area');
const sectionsContainer = document.getElementById('sections-container');
const addSectionBtn = document.getElementById('add-section-btn');
const columnsInput = document.getElementById('columns');
const rowsInput = document.getElementById('rows');
const gapInput = document.getElementById('gap');
const sectionGapInput = document.getElementById('section-gap');
const cssCode = document.getElementById('css-code');
const copyCssBtn = document.getElementById('copy-css-btn');
const saveLayoutBtn = document.getElementById('save-layout-btn');
const deleteLayoutBtn = document.getElementById('delete-layout-btn');
const layoutName = document.getElementById('layout-name');
const layoutThumbnails = document.getElementById('layout-thumbnails');
const themeToggle = document.getElementById('theme-toggle');
const breakpointBtns = document.querySelectorAll('.breakpoint-btn');
const addBreakpointBtn = document.getElementById('add-breakpoint-btn');
const undoBtn = document.getElementById('undo-btn');
const redoBtn = document.getElementById('redo-btn');

// Add this new object to store breakpoint-specific properties
const breakpointProperties = {};

// Add this at the beginning of your script
const breakpoints = {
    'desktop-large': { name: 'Desktop Large', width: 1920 },
    'desktop': { name: 'Desktop', width: 1440 },
    'laptop': { name: 'Laptop', width: 1024 },
    'tablet-landscape': { name: 'Tablet Landscape', width: 991 },
    'tablet': { name: 'Tablet', width: 768 },
    'mobile': { name: 'Mobile', width: 600 }
};

// Add this function to update breakpoint values
function updateBreakpointWidth(breakpointKey, newWidth) {
    if (breakpoints[breakpointKey]) {
        breakpoints[breakpointKey].width = newWidth;
        updateBreakpointButtons();
        updateCSS();
        if (currentBreakpoint === breakpointKey) {
            changeBreakpoint(breakpointKey); // Refresh the current breakpoint if it was changed
        }
    }
}

// Modify the getBreakpointWidth function
function getBreakpointWidth(breakpoint) {
    if (breakpoints[breakpoint]) {
        return `${breakpoints[breakpoint].width}px`;
    }
    return 'flex-grow'; // Use a special value for full width
}

// Update the changeBreakpoint function
function changeBreakpoint(breakpoint) {
    const oldBreakpoint = currentBreakpoint;
    currentBreakpoint = breakpoint;
    
    const gridContainer = document.querySelector('.grid-container');
    if (!gridContainer) {
        console.error("gridContainer not found");
        return;
    }
    
    updateBreakpointButtons();
    
    const width = getBreakpointWidth(breakpoint);
    
    // Add transition class
    gridContainer.classList.add('transitioning');
    
    if (width === 'flex-grow') {
        gridContainer.style.width = '100%';
        gridContainer.style.maxWidth = '100%';
    } else {
        gridContainer.style.width = width;
        gridContainer.style.maxWidth = width;
    }
    
    // Update areas for each section
    currentPage.sections.forEach(section => {
        if (!section.gridProperties[breakpoint]) {
            const defaultProps = getDefaultProperties(breakpoint);
            section.gridProperties[breakpoint] = {
                columns: defaultProps.columns,
                rows: defaultProps.rows,
                gap: defaultProps.gap,
                columnSize: `repeat(${defaultProps.columns}, 1fr)`,
                rowSize: `repeat(${defaultProps.rows}, 1fr)`
            };
        }
        if (!section.areas[breakpoint]) {
            section.areas[breakpoint] = JSON.parse(JSON.stringify(section.areas['default'] || []));
        }
        updateSectionForBreakpoint(section, breakpoint);
        updateSectionGrid(section);
        renderAreas(section);
    });
    
    if (selectedSection) {
        updateSidebarControls(selectedSection);
    }
    
    // Remove transition class after animation completes
    setTimeout(() => {
        gridContainer.classList.remove('transitioning');
    }, 300);
    
    updateCSS();
    
    // Trigger a custom event for breakpoint change
    const event = new CustomEvent('breakpointChanged', { 
        detail: { oldBreakpoint, newBreakpoint: breakpoint } 
    });
    document.dispatchEvent(event);
}

// Update the updateBreakpointButtons function
function updateBreakpointButtons() {
    const breakpointContainer = document.querySelector('.breakpoints');
    breakpointContainer.innerHTML = '';
    
    Object.keys(breakpoints).reverse().forEach(key => {
        const btnContainer = document.createElement('div');
        btnContainer.classList.add('breakpoint-btn-container');

        const btn = document.createElement('button');
        btn.classList.add('breakpoint-btn');
        btn.dataset.breakpoint = key;
        btn.textContent = `${breakpoints[key].name} (${breakpoints[key].width}px)`;
        btn.addEventListener('click', () => changeBreakpoint(key));
        if (key === currentBreakpoint) {
            btn.classList.add('active');
        }

        const editBtn = document.createElement('button');
        editBtn.classList.add('edit-breakpoint-btn');
        editBtn.textContent = 'Edit';
        editBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            editBreakpointWidth(key);
        });

        btnContainer.appendChild(btn);
        btnContainer.appendChild(editBtn);
        breakpointContainer.appendChild(btnContainer);
    });
    
    const addBreakpointBtn = document.createElement('button');
    addBreakpointBtn.id = 'add-breakpoint-btn';
    addBreakpointBtn.classList.add('tooltip');
    addBreakpointBtn.textContent = 'Add Breakpoint';
    addBreakpointBtn.innerHTML += '<span class="tooltiptext">Add a custom breakpoint for your responsive design</span>';
    addBreakpointBtn.addEventListener('click', addCustomBreakpoint);
    breakpointContainer.appendChild(addBreakpointBtn);
}

// Modify the addCustomBreakpoint function
function addCustomBreakpoint() {
    const name = prompt('Enter breakpoint name:');
    const width = parseInt(prompt('Enter breakpoint width (in pixels):'));
    if (name && !isNaN(width)) {
        const breakpointKey = name.toLowerCase().replace(/\s+/g, '-');
        breakpoints[breakpointKey] = { name, width };
        updateBreakpointButtons();
        updateCSS();
    }
}

// Add this function to allow editing breakpoint values
function editBreakpointWidth(breakpointKey) {
    const newWidth = parseInt(prompt(`Enter new width for ${breakpoints[breakpointKey].name} (in pixels):`, breakpoints[breakpointKey].width));
    if (!isNaN(newWidth)) {
        updateBreakpointWidth(breakpointKey, newWidth);
    }
}

// Load layouts from local storage
function loadLayoutsFromStorage() {
    const savedLayouts = localStorage.getItem('gridLayouts');
    if (savedLayouts) {
        layouts = JSON.parse(savedLayouts); // Load layouts from local storage
        updateLayoutThumbnails(); // Update the UI with loaded layouts
    }
}

// Save current layouts to local storage
function saveLayoutsToLocalStorage() {
    localStorage.setItem('gridLayouts', JSON.stringify(layouts)); // Save layouts object
}

// Update layout thumbnails
function updateLayoutThumbnails() {
    layoutThumbnails.innerHTML = '';
    Object.keys(layouts).forEach(name => {
        const layout = layouts[name];
        const thumbnail = document.createElement('div');
        thumbnail.classList.add('layout-thumbnail');

        const nameElement = document.createElement('div');
        nameElement.textContent = name;
        nameElement.classList.add('layout-name');
        thumbnail.appendChild(nameElement);

        const previewElement = document.createElement('div');
        previewElement.classList.add('layout-preview');

        layout.forEach(section => {
            const sectionPreview = document.createElement('div');
            sectionPreview.classList.add('section-preview');
            sectionPreview.style.display = 'grid';
            sectionPreview.style.gridTemplateColumns = section.columnSize;
            sectionPreview.style.gridTemplateRows = section.rowSize;
            sectionPreview.style.gap = section.gap;
            sectionPreview.style.margin = '2px 0';

            // Add cells to represent the grid
            for (let i = 0; i < section.rows; i++) {
                for (let j = 0; j < section.columns; j++) {
                    const cell = document.createElement('div');
                    cell.classList.add('preview-cell');
                    cell.style.gridColumn = `${j + 1}`;
                    cell.style.gridRow = `${i + 1}`;
                    sectionPreview.appendChild(cell);
                }
            }

            // Add named areas
            Object.values(section.areas).forEach(breakpointAreas => {
                breakpointAreas.forEach(area => {
                    const areaElement = document.createElement('div');
                    areaElement.classList.add('preview-area');
                    areaElement.style.gridColumnStart = area.startColumn;
                    areaElement.style.gridColumnEnd = area.endColumn + 1;
                    areaElement.style.gridRowStart = area.startRow;
                    areaElement.style.gridRowEnd = area.endRow + 1;
                    areaElement.style.backgroundColor = area.color || getRandomColor();
                    areaElement.style.opacity = '0.7';
                    areaElement.textContent = area.name;
                    sectionPreview.appendChild(areaElement);
                });
            });

            previewElement.appendChild(sectionPreview);
        });

        thumbnail.appendChild(previewElement);

        // Add delete button
        const deleteBtn = document.createElement('button');
        deleteBtn.classList.add('delete-layout');
        deleteBtn.textContent = '×';
        deleteBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            if (confirm(`Are you sure you want to delete the layout "${name}"?`)) {
                deleteLayout(name);
            }
        });
        thumbnail.appendChild(deleteBtn);

        thumbnail.addEventListener('click', () => loadLayout(name));
        layoutThumbnails.appendChild(thumbnail);
    });
}

// Create a new layout
function createNewLayout() {
    currentPage.sections = []; // Clear existing sections
    sectionsContainer.innerHTML = '';
    createInitialSection(); // Create the initial section
    saveLayoutsToLocalStorage(); // Save the new layout
    localStorage.removeItem('currentGridState'); // Clear the current state
    saveCurrentState(); // Save the new initial state
    updateSidebarControls(currentPage.sections[0]); // Update sidebar controls with the new section
}

// Save the current layout
function saveLayout() {
    const name = layoutName.value.trim();
    if (name) {
        if (layouts[name]) {
            if (!confirm(`A layout with the name "${name}" already exists. Do you want to overwrite it?`)) {
                return;
            }
        }
        layouts[name] = currentPage.sections.map(section => ({
            name: section.name,
            columns: section.columns,
            rows: section.rows,
            columnSize: section.columnSize,
            rowSize: section.rowSize,
            gap: section.gap,
            areas: section.areas
        }));
        saveLayoutsToLocalStorage();
        updateLayoutThumbnails();
        layoutName.value = '';
    } else {
        alert('Please enter a layout name.');
    }
}










// Initialize the application
function init() {
    loadCurrentState();
    if (currentPage.sections.length === 0) {
        createInitialSection();
    }
    loadLayoutsFromStorage();
    addEventListeners();
    updateCSS();
    
    updateBreakpointButtons();
    updateTabs(); // Make sure this line is here
    
    document.getElementById('new-layout-btn').addEventListener('click', createNewLayout);
    if (undoBtn) undoBtn.addEventListener('click', undo);
    if (redoBtn) redoBtn.addEventListener('click', redo);
    
    saveState();
    updateUndoRedoButtons();
    addGridControlListeners();
    
    changeBreakpoint(currentBreakpoint);
    
    // Update grid preview for each section
    currentPage.sections.forEach(section => {
        createVisualGrid(section);
        renderAreas(section);
    });
    
    // Render the loaded or initial state
    renderCurrentPage();
    if (currentPage.sections.length > 0) {
        selectSection(currentPage.sections[0]);
    }
}

// Create the initial grid section
function createInitialSection() {
    // Clear existing sections
    currentPage.sections = [];
    const container = document.getElementById('sections-container');
    container.innerHTML = '';

    const defaultProps = getDefaultProperties('desktop-large');
    const initialColumns = defaultProps.columns;
    const initialRows = defaultProps.rows;
    const initialColumnSize = `repeat(${initialColumns}, 1fr)`;
    const initialRowSize = `repeat(${initialRows}, 1fr)`;
    
    const initialGap = defaultProps.gap;
    const initialSection = createSection('Section 1', initialColumns, initialRows, initialColumnSize, initialRowSize, initialGap);
    currentPage.sections.push(initialSection);
    container.appendChild(initialSection.element);
    selectSection(initialSection);
    updateCSS();
    updateSidebarControls(initialSection); // Add this line
}

function createSection(name, columns, rows, columnSize, rowSize, gap) {
    const sectionElement = document.createElement('div');
    sectionElement.classList.add('grid-section');

    const sectionNameElement = document.createElement('div');
    sectionNameElement.classList.add('section-name');
    sectionNameElement.textContent = name;
    sectionElement.appendChild(sectionNameElement);

    sectionNameElement.addEventListener('dblclick', (e) => renameSection(e, section));

    const deleteBtn = document.createElement('button');
    deleteBtn.classList.add('delete-section');
    deleteBtn.textContent = '×';
    sectionElement.appendChild(deleteBtn);

    const visualGridContainer = document.createElement('div');
    visualGridContainer.classList.add('visual-grid-container');
    visualGridContainer.innerHTML = `
        <div class="column-controls"></div>
        <div class="row-controls"></div>
        <div class="grid-preview"></div>
    `;
    sectionElement.appendChild(visualGridContainer);

    const section = {
        element: sectionElement,
        name,
        columns,
        rows,
        columnSize: columnSize || `repeat(${columns}, 1fr)`,
        rowSize: rowSize || `repeat(${rows}, 1fr)`,
        gap: gap || '1rem',
        areas: {},
        currentBreakpoint: 'default',
        gridProperties: {}
    };

    // Initialize grid properties for all breakpoints
    Object.keys(breakpoints).forEach(bp => {
        const defaultProps = getDefaultProperties(bp);
        section.gridProperties[bp] = {
            columns: defaultProps.columns,
            rows: defaultProps.rows,
            gap: '1rem',
            columnSize: `repeat(${defaultProps.columns}, 1fr)`,
            rowSize: `repeat(${defaultProps.rows}, 1fr)`
        };
    });

    // Initialize areas for all breakpoints
    Object.keys(breakpoints).forEach(bp => {
        section.areas[bp] = [];
    });

    deleteBtn.addEventListener('click', () => deleteSection(section));
  
    sectionElement.addEventListener('click', (e) => {
        if (!e.target.closest('.grid-preview')) {
            selectSection(section, e);
        }
    });

    createVisualGrid(section);
    initDragAndDrop(section);

    const gridPreview = section.element.querySelector('.grid-preview');
    gridPreview.addEventListener('mousedown', (e) => handleMouseDown(e, section, e.target));
    gridPreview.addEventListener('mousemove', (e) => handleMouseMove(e, section, e.target));
    gridPreview.addEventListener('mouseup', (e) => handleMouseUp(e, section, e.target));

    gridPreview.addEventListener('dblclick', (e) => {
        const area = e.target.closest('.named-area');
        if (area) {
            if (e.altKey) { // Check for Alt key
                deleteArea(section, area);
            } else {
                renameArea(e, section, area);
            }
        }
    });

    return section;
}

function getDefaultProperties(breakpoint) {
    switch (breakpoint) {
        case 'desktop-large':
        case 'desktop':
            return { columns: 12, rows: 6, gap: '1rem' };
        case 'laptop':
            return { columns: 8, rows: 6, gap: '1rem' };
        case 'tablet-landscape':
            return { columns: 6, rows: 6, gap: '1rem' };
        case 'tablet':
            return { columns: 4, rows: 6, gap: '1rem' };
        case 'mobile':
            return { columns: 2, rows: 6, gap: '1rem' };
        default:
            return { columns: 12, rows: 6, gap: '1rem' };
    }
}

function deleteArea(section, areaElement) {
    const areaName = areaElement.textContent.trim();
    const breakpoints = Object.keys(section.areas);

    breakpoints.forEach(bp => {
        section.areas[bp] = section.areas[bp].filter(area => area.name !== areaName);
    });

    renderAreas(section);
    updateCSS();
    saveState();
}

let columnCounter = 0;
let rowCounter = 0;

function createUniqueIdentifier(type) {
    if (type === 'column') {
        return `col-${++columnCounter}`;
    } else {
        return `row-${++rowCounter}`;
    }
}

function updateDropdownOptions(type) {
    const controls = document.querySelectorAll(`.${type}-control .custom-dropdown`);
    controls.forEach((dropdown, index) => {
        dropdown.id = `${type}-${index + 1}`;
        dropdown.dataset.index = index;
        
        // Update the selected value to match the current size
        const sizes = type === 'column' ? selectedSection.columnSize.split(' ') : selectedSection.rowSize.split(' ');
        const currentSize = sizes[index] || '1fr';
        dropdown.querySelector('.selected').textContent = currentSize;
    });
}

function updateGridSize(type) {
    if (!selectedSection) return;

    const gridPreview = selectedSection.element.querySelector('.grid-preview');
    
    if (type === 'column') {
        gridPreview.style.gridTemplateColumns = selectedSection.columnSize;
    } else {
        gridPreview.style.gridTemplateRows = selectedSection.rowSize;
    }
}

function createCustomDropdown(options, initialValue, onChange, type, index) {
    const dropdown = document.createElement('div');
    dropdown.classList.add('custom-dropdown');

    const selected = document.createElement('div');
    selected.classList.add('selected');
    selected.textContent = initialValue;
    dropdown.appendChild(selected);

    const optionsList = document.createElement('ul');
    optionsList.classList.add('options');
    options.forEach(option => {
        const li = document.createElement('li');
        li.textContent = option;
        li.addEventListener('click', (e) => {
            e.stopPropagation();
            if (option === 'custom') {
                const customValue = prompt('Enter custom size (e.g., 100px, 50%):', initialValue);
                if (customValue) {
                    selected.textContent = customValue;
                    onChange(type, index, customValue);
                }
            } else {
                selected.textContent = option;
                onChange(type, index, option);
            }
            optionsList.style.display = 'none';
        });
        optionsList.appendChild(li);
    });
    dropdown.appendChild(optionsList);

    selected.addEventListener('click', (e) => {
        e.stopPropagation();
        optionsList.style.display = optionsList.style.display === 'block' ? 'none' : 'block';
    });

    document.addEventListener('click', () => {
        optionsList.style.display = 'none';
    });

    return dropdown;
}

// Handle mouse down event for drag-and-drop and resizing
function handleMouseDown(e, section, cell) {
    if (e.ctrlKey || e.metaKey) {
        isMoving = true;
        const areas = section.areas[section.currentBreakpoint] || section.areas['default'] || [];
        if (Array.isArray(areas)) {
            selectedArea = areas.find(area => 
                cell.dataset.col >= area.startColumn && cell.dataset.col <= area.endColumn &&
                cell.dataset.row >= area.startRow && cell.dataset.row <= area.endRow
            );
        } else {
            console.error('Areas for the current breakpoint is not an array:', areas);
            selectedArea = null;
        }
    } else {
        dragStartCell = cell;
    }
}

function handleMouseUp(e, section, cell) {
    if (isMoving) {
        isMoving = false;
        selectedArea = null;
    } else if (e.metaKey && dragStartCell && cell) {  // Check for COMMAND key here
        const areaName = prompt('Enter area name:');
        if (areaName) {
            addArea(section, dragStartCell, cell, areaName);
        }
        dragStartCell = null;
    }
    // Always reset dragStartCell at the end of the function
    dragStartCell = null;
}

function handleMouseMove(e, section, cell) {
    if (isMoving && selectedArea) {
        const deltaX = parseInt(cell.dataset.col) - selectedArea.startColumn;
        const deltaY = parseInt(cell.dataset.row) - selectedArea.startRow;
        moveArea(section, selectedArea, deltaX, deltaY);
    } else if (e.metaKey && dragStartCell) {  // Check for COMMAND key here
        highlightSelectedArea(section, dragStartCell, cell);
    }
}

// Highlight the selected area during drag
function highlightSelectedArea(section, startCell, endCell) {
    const startCol = Math.min(parseInt(startCell.dataset.col), parseInt(endCell.dataset.col));
    const endCol = Math.max(parseInt(startCell.dataset.col), parseInt(endCell.dataset.col));
    const startRow = Math.min(parseInt(startCell.dataset.row), parseInt(endCell.dataset.row));
    const endRow = Math.max(parseInt(startCell.dataset.row), parseInt(endCell.dataset.row));

    section.element.querySelectorAll('.grid-cell').forEach(cell => {
        const col = parseInt(cell.dataset.col);
        const row = parseInt(cell.dataset.row);
        cell.classList.toggle('highlighted', col >= startCol && col <= endCol && row >= startRow && row <= endRow);
    });
}

// Select a grid section
function selectSection(section, clickEvent = null) {
    if (!section || !section.element) {
        console.error("Invalid section or section element");
        return;
    }

    // Remove 'selected' class from all sections
    currentPage.sections.forEach(s => {
        if (s && s.element) {
            s.element.classList.remove('selected');
        } else {
            console.warn("Found an invalid section:", s);
        }
    });
    
    // Add 'selected' class to the current section
    section.element.classList.add('selected');
    selectedSection = section;
    
    // Update the inputs if they exist
    const columnsInput = document.getElementById('columns');
    const rowsInput = document.getElementById('rows');
    const gapInput = document.getElementById('gap');

    if (columnsInput) columnsInput.value = section.columns;
    if (rowsInput) rowsInput.value = section.rows;
    if (gapInput) gapInput.value = parseFloat(section.gap);
    
    // Only recreate the visual grid if the click was outside the grid-preview
    if (!clickEvent || !clickEvent.target.closest('.grid-preview')) {
        createVisualGrid(section);
    }
    
    // Always render areas for the selected section
    renderAreas(section);

    // Update sidebar controls
    updateSidebarControls(section);
}

// Delete a section
function deleteSection(section) {
    const index = currentPage.sections.indexOf(section);
    if (index > -1) {
        currentPage.sections.splice(index, 1);
        sectionsContainer.removeChild(section.element);
        if (currentPage.sections.length > 0) {
            selectSection(currentPage.sections[0]);
        }
        updateCSS();
        saveCurrentState(); // Add this line
    }
}

// Resize a section
function resizeSection(section, startCell, endCell) {
    const startCol = Math.min(parseInt(startCell.dataset.col), parseInt(endCell.dataset.col));
    const endCol = Math.max(parseInt(startCell.dataset.col), parseInt(endCell.dataset.col));
    const startRow = Math.min(parseInt(startCell.dataset.row), parseInt(endCell.dataset.row));
    const endRow = Math.max(parseInt(startCell.dataset.row), parseInt(endCell.dataset.row));

    section.columns = endCol - startCol + 1;
    section.rows = endRow - startRow + 1;

    updateSectionGrid(section);
    selectSection(section);
    updateCSS();
}

function createVisualGrid(section) {
    const gridPreview = section.element.querySelector('.grid-preview');
    gridPreview.innerHTML = ''; // Clear existing content

    for (let i = 0; i < section.rows; i++) {
        for (let j = 0; j < section.columns; j++) {
            const cell = document.createElement('div');
            cell.classList.add('grid-cell');
            cell.dataset.row = i + 1;
            cell.dataset.col = j + 1;
            cell.textContent = `${i+1},${j+1}`;
            gridPreview.appendChild(cell);
        }
    }

    gridPreview.style.gridTemplateColumns = section.columnSize;
    gridPreview.style.gridTemplateRows = section.rowSize;
    gridPreview.style.gap = section.gap || '1rem'; // Ensure gap is always set
}

function createSizeControl(type, index, initialSize) {
  const control = document.createElement('div');
    control.classList.add('size-control', `${type}-control`);

    const addLeftButton = document.createElement('button');
    addLeftButton.classList.add('add-button', 'add-left');
    addLeftButton.innerHTML = '+';
    addLeftButton.title = `Add ${type} to the left`;
    addLeftButton.addEventListener('click', () => addSizeControl(type, index, 'left'));
    control.appendChild(addLeftButton);

    const dropdown = createCustomDropdown(
        ['auto', '1fr', '2fr', '3fr', 'min-content', 'max-content', 'custom'],
        initialSize || '1fr',
        updateSize,
        type,
        index
    );
    dropdown.id = `${type}-${index + 1}`;
    dropdown.dataset.index = index;
    control.appendChild(dropdown);

    const addRightButton = document.createElement('button');
    addRightButton.classList.add('add-button', 'add-right');
    addRightButton.innerHTML = '+';
    addRightButton.title = `Add ${type} to the right`;
    addRightButton.addEventListener('click', () => addSizeControl(type, index, 'right'));
    control.appendChild(addRightButton);

    const deleteButton = document.createElement('button');
    deleteButton.classList.add('delete-button');
    deleteButton.innerHTML = '×';
    deleteButton.title = `Delete ${type}`;
    deleteButton.addEventListener('click', () => removeSizeControl(type, index));
    control.appendChild(deleteButton);

    return control;
}

function updateSize(type, index, value) {
    if (selectedSection) {
        const sizeProperty = type === 'column' ? 'columnSize' : 'rowSize';
        let sizes = selectedSection[sizeProperty].split(' ');

        // Handle repeat() function
        sizes = sizes.map(size => {
            if (size.startsWith('repeat(')) {
                const match = size.match(/repeat\((\d+),\s*(.+)\)/);
                if (match) {
                    const count = parseInt(match[1]);
                    const pattern = match[2].trim().split(' ');
                    if (index < count) {
                        pattern[index] = value;
                    }
                    return `repeat(${count}, ${pattern.join(' ')})`;
                }
            }
            return size;
        });

        // Ensure the sizes array has the correct length
        while (sizes.length < selectedSection[type === 'column' ? 'columns' : 'rows']) {
            sizes.push('1fr');
        }

        sizes[index] = value;
        selectedSection[sizeProperty] = sizes.join(' ');

        // Update the visual representation
        createVisualGrid(selectedSection);

        // Update the CSS output
        updateCSS();

        // Update the grid size
        updateGridSize(type);
    }
}

function modifySizeControl(type, index, action, direction = 'right') {
    if (selectedSection) {
        const isColumn = type === 'column';
        const sizeProperty = isColumn ? 'columnSize' : 'rowSize';
        const countProperty = isColumn ? 'columns' : 'rows';
        
        if (action === 'add' && (!isColumn || selectedSection[countProperty] < 24)) {
            selectedSection[countProperty]++;
            const sizes = selectedSection[sizeProperty].split(' ');
            const insertIndex = direction === 'left' ? index : index + 1;
            sizes.splice(insertIndex, 0, '1fr');
            selectedSection[sizeProperty] = sizes.join(' ');
        } else if (action === 'remove' && selectedSection[countProperty] > 1) {
            selectedSection[countProperty]--;
            const sizes = selectedSection[sizeProperty].split(' ');
            sizes.splice(index, 1);
            selectedSection[sizeProperty] = sizes.join(' ');
        }

        createVisualGrid(selectedSection);
        updateDropdownOptions(type);
        updateGridSize(type);
        updateSectionGrid(selectedSection);
        updateCSS();
    }
}

function addSizeControl(type, index, direction = 'right') {
    if (selectedSection) {
        const isColumn = type === 'column';
        const sizeProperty = isColumn ? 'columnSize' : 'rowSize';
        const countProperty = isColumn ? 'columns' : 'rows';
        
        selectedSection[countProperty]++;
        const sizes = selectedSection[sizeProperty].split(' ');
        const insertIndex = direction === 'left' ? index : index + 1;
        sizes.splice(insertIndex, 0, '1fr');
        selectedSection[sizeProperty] = sizes.join(' ');

        createVisualGrid(selectedSection);
        updateGridSize(type);
        updateCSS();
    }
}

function removeSizeControl(type, index) {
    if (selectedSection) {
        const isColumn = type === 'column';
        const sizeProperty = isColumn ? 'columnSize' : 'rowSize';
        const countProperty = isColumn ? 'columns' : 'rows';
        
        if (selectedSection[countProperty] > 1) {
            selectedSection[countProperty]--;
            const sizes = selectedSection[sizeProperty].split(' ');
            sizes.splice(index, 1);
            selectedSection[sizeProperty] = sizes.join(' ');

            createVisualGrid(selectedSection);
            updateGridSize(type);
            updateCSS();
        }
    }
}

// Add event listeners
function addEventListeners() {
    if (addSectionBtn) {
        addSectionBtn.removeEventListener('click', addSection); // Remove any existing listener
        addSectionBtn.addEventListener('click', addSection);
    }

    if (columnsInput) columnsInput.addEventListener('change', updateSelectedSectionGrid);
    if (rowsInput) rowsInput.addEventListener('change', updateSelectedSectionGrid);
    if (gapInput) gapInput.addEventListener('change', updateSelectedSectionGrid);
    if (sectionGapInput) sectionGapInput.addEventListener('change', updateSectionGap);

    if (copyCssBtn) copyCssBtn.addEventListener('click', copyCSS);
    if (saveLayoutBtn) saveLayoutBtn.addEventListener('click', saveLayout); // Ensure this is set
    if (deleteLayoutBtn) deleteLayoutBtn.addEventListener('click', deleteLayout);
    if (themeToggle) themeToggle.addEventListener('click', toggleTheme);

    if (breakpointBtns) {
        breakpointBtns.forEach(btn => {
            btn.addEventListener('click', () => changeBreakpoint(btn.dataset.breakpoint));
        });
    }

    if (addBreakpointBtn) addBreakpointBtn.addEventListener('click', addCustomBreakpoint);
}

// Modify the addSection function
function addSection() {
    const sectionName = `Section ${currentPage.sections.length + 1}`;
    const defaultColumns = getDefaultColumns(currentBreakpoint);
    const newSection = createSection(sectionName, defaultColumns, 6, `repeat(${defaultColumns}, 1fr)`, 'repeat(6, 1fr)', '1rem');
    
    // Initialize grid properties for all breakpoints
    Object.keys(breakpoints).forEach(bp => {
        const bpColumns = getDefaultColumns(bp);
        newSection.gridProperties[bp] = {
            columns: bpColumns,
            rows: 6,
            gap: '1rem',
            columnSize: `repeat(${bpColumns}, 1fr)`,
            rowSize: 'repeat(6, 1fr)'
        };
    });

    currentPage.sections.push(newSection);
    sectionsContainer.appendChild(newSection.element);
    selectSection(newSection);
    updateSectionForBreakpoint(newSection, currentBreakpoint);
    updateCSS();
    saveCurrentState(); // Add this line
}

document.getElementById('undo-btn').addEventListener('click', undo);
document.getElementById('redo-btn').addEventListener('click', redo);

// Update the selected section's grid
function updateSelectedSectionGrid() {
    if (selectedSection) {
        const oldColumns = selectedSection.columns;
        const oldRows = selectedSection.rows;
        selectedSection.columns = parseInt(columnsInput.value);
        selectedSection.rows = parseInt(rowsInput.value);
        selectedSection.gap = gapInput.value;

        // Adjust column sizes
        let columnSizes = selectedSection.columnSize.split(' ').map(size => size.startsWith('repeat(') ? '1fr' : size);
        if (selectedSection.columns > oldColumns) {
            columnSizes = columnSizes.concat(Array(selectedSection.columns - oldColumns).fill('1fr'));
        } else if (selectedSection.columns < oldColumns) {
            columnSizes = columnSizes.slice(0, selectedSection.columns);
        }
        selectedSection.columnSize = columnSizes.join(' ');

        // Adjust row sizes
        let rowSizes = selectedSection.rowSize.split(' ').map(size => size.startsWith('repeat(') ? '1fr' : size);
        if (selectedSection.rows > oldRows) {
            rowSizes = rowSizes.concat(Array(selectedSection.rows - oldRows).fill('1fr'));
        } else if (selectedSection.rows < oldRows) {
            rowSizes = rowSizes.slice(0, selectedSection.rows);
        }
        selectedSection.rowSize = rowSizes.join(' ');

        updateSectionGrid(selectedSection);
    }
}

// Update a section's grid
function updateSectionGrid(section) {
    section.gap = gapInput.value;
    createVisualGrid(section);
    renderAreas(section);
    updateCSS();
    saveLayoutsToLocalStorage();
    saveCurrentState(); // Add this line
}
// Update the gap between sections
function updateSectionGap() {
    const gap = sectionGapInput.value;
    sectionsContainer.style.gap = gap;
    updateCSS();
}

// Helper function to ensure areas exist for all breakpoints
function ensureAreasForAllBreakpoints(section, area) {
    const breakpointKeys = Object.keys(breakpoints);
    breakpointKeys.forEach(breakpoint => {
        if (!section.areas[breakpoint]) {
            section.areas[breakpoint] = [];
        }
        const existingAreaIndex = section.areas[breakpoint].findIndex(a => a.name === area.name);
        if (existingAreaIndex !== -1) {
            section.areas[breakpoint][existingAreaIndex] = area;
        } else {
            section.areas[breakpoint].push(area);
        }
    });
}

// Add a new area to the selected section
function addArea(section, startCell, endCell, name) {
    if (!startCell || !endCell || !name) {
        console.error('Invalid input for addArea');
        return;
    }

    const startCol = parseInt(startCell.dataset.col);
    const startRow = parseInt(startCell.dataset.row);
    const endCol = parseInt(endCell.dataset.col);
    const endRow = parseInt(endCell.dataset.row);

    if (isNaN(startCol) || isNaN(startRow) || isNaN(endCol) || isNaN(endRow)) {
        console.error('Invalid grid coordinates');
        return;
    }

    if (name.trim() === '') {
        alert('Area name cannot be empty');
        return;
    }

    // Ensure the areas object for the current breakpoint exists
    if (!section.areas[currentBreakpoint]) {
        section.areas[currentBreakpoint] = [];
    }

    // Check if the area name already exists
    const existingArea = section.areas[currentBreakpoint].find(area => area.name === name);
    if (existingArea) {
        alert('An area with this name already exists. Please choose a different name.');
        return;
    }

    const minCol = Math.min(startCol, endCol);
    const maxCol = Math.max(startCol, endCol);
    const minRow = Math.min(startRow, endRow);
    const maxRow = Math.max(startRow, endRow);

    const color = getRandomColor();

    const newArea = {
        name,
        startColumn: minCol,
        startRow: minRow,
        endColumn: maxCol,
        endRow: maxRow,
        color
    };

    ensureAreasForAllBreakpoints(section, newArea);

    renderAreas(section);
    updateCSS();
    saveState();
    saveCurrentState();
}

// Update the position of an area
function updateAreaPosition(section, area) {
    if (!area) return;

    const areaName = area.textContent.trim();
    const startColumn = parseInt(area.style.gridColumnStart);
    const endColumn = parseInt(area.style.gridColumnEnd) - 1;
    const startRow = parseInt(area.style.gridRowStart);
    const endRow = parseInt(area.style.gridRowEnd) - 1;

    const updatedArea = {
        name: areaName,
        startColumn,
        endColumn,
        startRow,
        endRow,
        color: area.style.backgroundColor
    };

    ensureAreasForAllBreakpoints(section, updatedArea);

    updateCSS();
    saveState();
    saveCurrentState(); // Add this line
}

function getRandomColor() {
    const hue = Math.floor(Math.random() * 360); // Random hue between 0 and 359
    const saturation = 100; // Fixed saturation (70%)
    const lightness = 60; // Fixed lightness (60%)
    const alpha = 1; // Set transparency to 70% (adjust as needed)
    return `hsla(${hue}, ${saturation}%, ${lightness}%, ${alpha})`;
}

function renameArea(event, section, areaElement) {
    console.log('renameArea function called');
    event.stopPropagation();
    
    const oldName = areaElement.textContent;
    console.log('Old name:', oldName);
    
    const input = document.createElement('input');
    input.type = 'text';
    input.value = oldName;
    input.style.width = '100%';
    input.style.height = '100%';
    input.style.boxSizing = 'border-box';
    input.style.fontSize = window.getComputedStyle(areaElement).fontSize;
    input.style.textAlign = 'center';
    
    areaElement.textContent = '';
    areaElement.appendChild(input);
    input.focus();
    input.select();

    let isRenaming = false;

    function handleRename() {
        if (isRenaming) return;
        isRenaming = true;

        console.log('handleRename function called');
        const newName = input.value.trim();
        console.log('New name:', newName);
        if (newName && newName !== oldName) {
            if (section.areas[currentBreakpoint].some(area => area.name === newName)) {
                alert('An area with this name already exists. Please choose a different name.');
                areaElement.textContent = oldName;
            } else {
                areaElement.textContent = newName;
                
                // Update the area name in the section's areas data for all breakpoints
                for (let bp in section.areas) {
                    const areaData = section.areas[bp].find(a => a.name === oldName);
                    if (areaData) {
                        areaData.name = newName;
                    }
                }
                
                updateCSS();
                saveState();
                console.log('Area renamed successfully');
            }
        } else {
            areaElement.textContent = oldName;
            console.log('Area name unchanged');
        }

        isRenaming = false;
    }

    input.addEventListener('blur', handleRename);
    input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            input.blur(); // This will trigger the blur event and call handleRename
        }
    });
}

function renameSection(event, section) {
    event.stopPropagation();

    const sectionNameElement = event.target;
    const oldName = sectionNameElement.textContent.trim();

    const input = document.createElement('input');
    input.type = 'text';
    input.value = oldName;
    input.style.width = '100%';
    input.style.height = '100%';
    input.style.boxSizing = 'border-box';
    input.style.fontSize = window.getComputedStyle(sectionNameElement).fontSize;
    input.style.textAlign = 'center';

    sectionNameElement.textContent = '';
    sectionNameElement.appendChild(input);
    input.focus();
    input.select();

    let isRenaming = false;

    function handleRename() {
        if (isRenaming) return;
        isRenaming = true;

        const newName = input.value.trim();
        if (newName && newName !== oldName) {
            sectionNameElement.textContent = newName;
            section.name = newName;
            updateCSS();
            saveState();
        } else {
            sectionNameElement.textContent = oldName;
        }

        isRenaming = false;
    }

    input.addEventListener('blur', handleRename);
    input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            input.blur(); // This will trigger the blur event and call handleRename
        }
    });
}

// Move an area
function moveArea(section, area, deltaX, deltaY) {
    area.startColumn = Math.max(1, Math.min(section.columns, area.startColumn + deltaX));
    area.endColumn = Math.max(1, Math.min(section.columns + 1, area.endColumn + deltaX));
    area.startRow = Math.max(1, Math.min(section.rows, area.startRow + deltaY));
    area.endRow = Math.max(1, Math.min(section.rows + 1, area.endRow + deltaY));
    updateCSS();
    renderAreas(section);
}

// Render areas on the grid
function renderAreas(section) {
    const gridPreview = section.element.querySelector('.grid-preview');
    gridPreview.querySelectorAll('.named-area').forEach(el => el.remove());
    
    const areas = section.areas[currentBreakpoint] || [];
    areas.forEach(area => {
        const areaElement = createNamedArea(
            area.name,
            area.startColumn,
            area.startRow,
            area.endColumn,
            area.endRow,
            area.color
        );
        gridPreview.appendChild(areaElement);
    });
}

function getRandomColor() {
    const hue = Math.floor(Math.random() * 360); // Random hue between 0 and 359
    const saturation = 96; // Fixed saturation (70%)
    const lightness = 40; // Fixed lightness (60%)
    const alpha = 1; // Set transparency to 70% (adjust as needed)
    return `hsla(${hue}, ${saturation}%, ${lightness}%, ${alpha})`;
}

// Get breakpoint width
function getBreakpointWidth(breakpoint) {
    if (breakpoints[breakpoint]) {
        return `${breakpoints[breakpoint].width}px`;
    }
    return 'flex-grow'; // Use a special value for full width
}

// Update CSS output
function updateCSS() {
    let css = '';
    const breakpointKeys = Object.keys(breakpoints).sort((a, b) => breakpoints[b].width - breakpoints[a].width);

    css += `#sections-container {\n  display: flex;\n  flex-direction: column;\n  gap: ${sectionGapInput.value};\n}\n\n`;

    pages.forEach(page => {
        breakpointKeys.forEach((breakpoint, index) => {
            const nextBreakpoint = breakpointKeys[index + 1];
            let mediaQuery;
            
            if (nextBreakpoint) {
                mediaQuery = `@media (max-width: ${breakpoints[breakpoint].width}px) {\n`;
            } else {
                mediaQuery = '';
            }

            let breakpointCSS = '';

            page.sections.forEach((section) => {
                const sectionClass = `.section-${section.name.replace(/\s+/g, '-').toLowerCase()}`;
                breakpointCSS += `  ${sectionClass} {\n    display: grid;\n    grid-template-columns: ${section.columnSize};\n    grid-template-rows: ${section.rowSize};\n    gap: ${section.gap};\n`;
                
                // Generate grid-template-areas
                const areas = section.areas[breakpoint] || section.areas['default'] || [];
                if (areas.length > 0) {
                    const gridAreas = generateGridTemplateAreas(section.columns, section.rows, areas);
                    breakpointCSS += `    grid-template-areas:\n      ${gridAreas.join('\n      ')};\n`;
                }
                
                breakpointCSS += `  }\n\n`;

                // Generate grid-area for each named area
                areas.forEach(area => {
                    breakpointCSS += `  ${sectionClass} .${area.name} {\n    grid-area: ${area.name};\n  }\n\n`;
                });
            });

            if (breakpointCSS) {
                css += mediaQuery + breakpointCSS;
                if (mediaQuery) {
                    css += '}\n\n';
                }
            }
        });
    });

    cssCode.textContent = css;
}

function generateGridTemplateAreas(columns, rows, areas) {
    const grid = Array(rows).fill().map(() => Array(columns).fill('.'));
    
    areas.forEach(area => {
        if (!area || typeof area.startRow !== 'number' || typeof area.endRow !== 'number' ||
            typeof area.startColumn !== 'number' || typeof area.endColumn !== 'number') {
            console.warn('Invalid area:', area);
            return;
        }
        
        const startRow = Math.max(0, area.startRow - 1);
        const endRow = Math.min(rows, area.endRow);
        const startCol = Math.max(0, area.startColumn - 1);
        const endCol = Math.min(columns, area.endColumn);
        
        for (let i = startRow; i < endRow; i++) {
            for (let j = startCol; j < endCol; j++) {
                if (grid[i] && grid[i][j] !== undefined) {
                    grid[i][j] = area.name;
                }
            }
        }
    });
    
    return grid.map(row => `"${row.join(' ')}"`);
}

// Copy CSS to clipboard
function copyCSS() {
    navigator.clipboard.writeText(cssCode.textContent).then(() => {
        alert('CSS copied to clipboard!');
    });
}

// Delete selected layout
function deleteLayout(name) {
    if (layouts[name]) {
        delete layouts[name];
        localStorage.setItem('gridLayouts', JSON.stringify(layouts));
        updateLayoutThumbnails();
    } else {
        alert('Layout not found.');
    }
}

// Load a saved layout
function loadLayout(name) {
    if (layouts[name]) {
        try {
            currentPage.sections = JSON.parse(JSON.stringify(layouts[name]));
            sectionsContainer.innerHTML = '';
            currentPage.sections = currentPage.sections.map(sectionData => {
                const section = createSection(sectionData.name, sectionData.columns, sectionData.rows, sectionData.columnSize, sectionData.rowSize, sectionData.gap);
                section.areas = sectionData.areas || {};
                sectionsContainer.appendChild(section.element);
                createVisualGrid(section);
                renderAreas(section);
                return section;
            });
            if (currentPage.sections.length > 0) {
                selectSection(currentPage.sections[0]);
            } else {
                console.warn("No sections found in the loaded layout");
            }
            updateCSS();
        } catch (error) {
            console.error(`Error loading layout "${name}":`, error);
            alert(`An error occurred while loading the layout. Please try again or contact support if the problem persists.`);
        }
    } else {
        console.error(`Layout "${name}" not found`);
        alert(`Layout "${name}" not found. Please check the layout name and try again.`);
    }
}

// Toggle between light and dark themes
function toggleTheme() {
    document.body.classList.toggle('dark-theme');
}

// Add this new function to set default columns based on breakpoint
function getDefaultColumns(breakpoint) {
    return getDefaultProperties(breakpoint).columns;
}

// Ensure the changeBreakpoint function correctly updates the grid properties for the selected section
function changeBreakpoint(breakpoint) {
    const oldBreakpoint = currentBreakpoint;
    currentBreakpoint = breakpoint;
    
    const gridContainer = document.querySelector('.grid-container');
    if (!gridContainer) {
        console.error("gridContainer not found");
        return;
    }
    
    updateBreakpointButtons();
    
    const width = getBreakpointWidth(breakpoint);
    
    // Add transition class
    gridContainer.classList.add('transitioning');
    
    if (width === 'flex-grow') {
        gridContainer.style.width = '100%';
        gridContainer.style.maxWidth = '100%';
    } else {
        gridContainer.style.width = width;
        gridContainer.style.maxWidth = width;
    }
    
    // Update areas for each section
    currentPage.sections.forEach(section => {
        if (!section.gridProperties[breakpoint]) {
            const defaultProps = getDefaultProperties(breakpoint);
            section.gridProperties[breakpoint] = {
                columns: defaultProps.columns,
                rows: defaultProps.rows,
                gap: defaultProps.gap,
                columnSize: `repeat(${defaultProps.columns}, 1fr)`,
                rowSize: `repeat(${defaultProps.rows}, 1fr)`
            };
        }
        if (!section.areas[breakpoint]) {
            section.areas[breakpoint] = JSON.parse(JSON.stringify(section.areas['default'] || []));
        }
        updateSectionForBreakpoint(section, breakpoint);
        updateSectionGrid(section);
        renderAreas(section);
    });
    
    if (selectedSection) {
        updateSidebarControls(selectedSection);
    }
    
    // Remove transition class after animation completes
    setTimeout(() => {
        gridContainer.classList.remove('transitioning');
    }, 300);
    
    updateCSS();
    
    // Trigger a custom event for breakpoint change
    const event = new CustomEvent('breakpointChanged', { 
        detail: { oldBreakpoint, newBreakpoint: breakpoint } 
    });
    document.dispatchEvent(event);
}

// Ensure the updateSectionForBreakpoint function correctly updates the grid properties for the selected section
function updateSectionForBreakpoint(section, breakpoint) {
    if (!section.gridProperties[breakpoint]) {
        const defaultProps = getDefaultProperties(breakpoint);
        section.gridProperties[breakpoint] = {
            columns: defaultProps.columns,
            rows: defaultProps.rows,
            gap: defaultProps.gap,
            columnSize: `repeat(${defaultProps.columns}, 1fr)`,
            rowSize: `repeat(${defaultProps.rows}, 1fr)`
        };
    }
    if (!section.areas[breakpoint]) {
        section.areas[breakpoint] = JSON.parse(JSON.stringify(section.areas['default'] || []));
    }

    // Update grid properties
    const gridProperties = section.gridProperties[breakpoint];
    section.columns = gridProperties.columns;
    section.rows = gridProperties.rows;
    section.gap = gridProperties.gap;
    section.columnSize = gridProperties.columnSize;
    section.rowSize = gridProperties.rowSize;

    // Adjust areas to fit within the new grid dimensions
    section.areas[breakpoint] = section.areas[breakpoint].map(area => ({
        ...area,
        startColumn: Math.min(area.startColumn, section.columns),
        endColumn: Math.min(area.endColumn, section.columns),
        startRow: Math.min(area.startRow, section.rows),
        endRow: Math.min(area.endRow, section.rows)
    }));

    // Update visual grid
    createVisualGrid(section);

    // Update areas
    renderAreas(section);
}

function updateAreasForBreakpoint(section, breakpoint) {
    if (!section.areas[breakpoint]) {
        section.areas[breakpoint] = JSON.parse(JSON.stringify(section.areas['default'] || []));
    }

    // Update visual representation of areas
    const gridPreview = section.element.querySelector('.grid-preview');
    gridPreview.querySelectorAll('.named-area').forEach(area => area.remove());

    section.areas[breakpoint].forEach(area => {
        const areaElement = createNamedArea(
            area.name,
            area.startColumn,
            area.startRow,
            area.endColumn,
            area.endRow
        );
        gridPreview.appendChild(areaElement);
    });
}

function createNamedArea(name, startCol, startRow, endCol, endRow, color) {
    const area = document.createElement('div');
    area.classList.add('named-area');
    area.textContent = name;
    area.dataset.name = name; // Add this line
    area.style.gridColumnStart = startCol;
    area.style.gridColumnEnd = endCol + 1;
    area.style.gridRowStart = startRow;
    area.style.gridRowEnd = endRow + 1;
    area.style.backgroundColor = color;
    area.style.borderColor = color.replace('0.3)', '0.5)'); // Slightly darker border

    // Add resize handles
    const handles = ['nw', 'ne', 'sw', 'se'];
    handles.forEach(direction => {
        const handle = document.createElement('div');
        handle.classList.add('resize-handle', `resize-${direction}`);
        area.appendChild(handle);
    });

    return area;
}

function initDragAndDrop(section) {
    const gridPreview = section.element.querySelector('.grid-preview');
    let isDragging = false;
    let draggedArea = null;
    let startCell, endCell;
    let startGridPosition;

    let isResizing = false;
    let resizeHandle = null;

    gridPreview.addEventListener('mousedown', startDrag);
    document.addEventListener('mousemove', drag);
    document.addEventListener('mouseup', endDrag); // Ensure mouseup is handled globally

    function startDrag(e) {
        console.log('startDrag', { isDragging, isResizing, draggedArea, resizeHandle });
        if (e.metaKey || e.ctrlKey) {
            // Existing area creation logic
            const cell = e.target.closest('.grid-cell');
            if (cell) {
                isDragging = true;
                startCell = cell;
                endCell = cell;
                updatePreview(section, startCell, endCell);
            }
        } else {
            const handle = e.target.closest('.resize-handle');
            if (handle) {
                e.preventDefault();
                isResizing = true;
                resizeHandle = handle;
                draggedArea = handle.closest('.named-area');
                startGridPosition = {
                    columnStart: parseInt(draggedArea.style.gridColumnStart),
                    columnEnd: parseInt(draggedArea.style.gridColumnEnd) - 1,
                    rowStart: parseInt(draggedArea.style.gridRowStart),
                    rowEnd: parseInt(draggedArea.style.gridRowEnd) - 1
                };
            } else {
                // Existing area dragging logic
                const area = e.target.closest('.named-area');
                if (area) {
                    e.preventDefault();
                    isDragging = true;
                    draggedArea = area;
                    startGridPosition = {
                        columnStart: parseInt(area.style.gridColumnStart),
                        columnEnd: parseInt(area.style.gridColumnEnd) - 1,
                        rowStart: parseInt(area.style.gridRowStart),
                        rowEnd: parseInt(area.style.gridRowEnd) - 1
                    };
                }
            }
        }
    }

    function drag(e) {
        if (!isDragging && !isResizing) return;

        if (isResizing) {
            const gridRect = gridPreview.getBoundingClientRect();
            const cellWidth = gridRect.width / section.columns;
            const cellHeight = gridRect.height / section.rows;

            let newColumnStart = startGridPosition.columnStart;
            let newColumnEnd = startGridPosition.columnEnd;
            let newRowStart = startGridPosition.rowStart;
            let newRowEnd = startGridPosition.rowEnd;

            const direction = resizeHandle.className.split(' ')[1].split('-')[1];

            if (direction.includes('w')) {
                newColumnStart = Math.max(1, Math.min(startGridPosition.columnEnd, Math.round((e.clientX - gridRect.left) / cellWidth) + 1));
            }
            if (direction.includes('e')) {
                newColumnEnd = Math.max(startGridPosition.columnStart, Math.min(section.columns, Math.round((e.clientX - gridRect.left) / cellWidth)));
            }
            if (direction.includes('n')) {
                newRowStart = Math.max(1, Math.min(startGridPosition.rowEnd, Math.round((e.clientY - gridRect.top) / cellHeight) + 1));
            }
            if (direction.includes('s')) {
                newRowEnd = Math.max(startGridPosition.rowStart, Math.min(section.rows, Math.round((e.clientY - gridRect.top) / cellHeight)));
            }

            draggedArea.style.gridColumnStart = newColumnStart;
            draggedArea.style.gridColumnEnd = newColumnEnd + 1;
            draggedArea.style.gridRowStart = newRowStart;
            draggedArea.style.gridRowEnd = newRowEnd + 1;

            // Update the area data
            const areaName = draggedArea.textContent.trim();
            const areaData = section.areas[currentBreakpoint].find(a => a.name === areaName);
            if (areaData) {
                areaData.startColumn = newColumnStart;
                areaData.endColumn = newColumnEnd;
                areaData.startRow = newRowStart;
                areaData.endRow = newRowEnd;
            }

            updateCSS();
        } else if (draggedArea) {
            const gridRect = gridPreview.getBoundingClientRect();
            const cellWidth = gridRect.width / section.columns;
            const cellHeight = gridRect.height / section.rows;

            const newColumnStart = Math.max(1, Math.min(section.columns, Math.round((e.clientX - gridRect.left) / cellWidth)));
            const newRowStart = Math.max(1, Math.min(section.rows, Math.round((e.clientY - gridRect.top) / cellHeight)));

            const width = startGridPosition.columnEnd - startGridPosition.columnStart + 1;
            const height = startGridPosition.rowEnd - startGridPosition.rowStart + 1;

            const newColumnEnd = Math.min(section.columns, newColumnStart + width - 1);
            const newRowEnd = Math.min(section.rows, newRowStart + height - 1);

            // Ensure the area does not shrink
            if (newColumnEnd - newColumnStart + 1 === width && newRowEnd - newRowStart + 1 === height) {
                draggedArea.style.gridColumnStart = newColumnStart;
                draggedArea.style.gridColumnEnd = newColumnEnd + 1;
                draggedArea.style.gridRowStart = newRowStart;
                draggedArea.style.gridRowEnd = newRowEnd + 1;

                // Update startGridPosition to the new position
                startGridPosition = {
                    columnStart: newColumnStart,
                    columnEnd: newColumnEnd,
                    rowStart: newRowStart,
                    rowEnd: newRowEnd
                };
            }
        } else {
            // Existing area creation logic
            const cell = document.elementFromPoint(e.clientX, e.clientY);
            if (cell && cell.classList.contains('grid-cell')) {
                endCell = cell;
                updatePreview(section, startCell, endCell);
            }
        }
    }

    function endDrag() {
        console.log('endDrag', { isDragging, isResizing, draggedArea, resizeHandle });
        if (isResizing || (isDragging && draggedArea)) {
            updateAreaPosition(section, draggedArea);
        } else if (isDragging && startCell && endCell) {
            // Existing area creation logic
            const areaName = prompt('Enter area name:');
            if (areaName) {
                addArea(section, startCell, endCell, areaName);
            }
            removePreview();
        }

        isDragging = false;
        isResizing = false;
        draggedArea = null;
        resizeHandle = null;
        startCell = null;
        endCell = null;
        startGridPosition = null;
    }
}

function updateAreaPosition(section, area) {
    if (!area) return;

    const breakpoint = currentBreakpoint;
    const areaName = area.textContent.trim();
    const startColumn = parseInt(area.style.gridColumnStart);
    const endColumn = parseInt(area.style.gridColumnEnd) - 1;
    const startRow = parseInt(area.style.gridRowStart);
    const endRow = parseInt(area.style.gridRowEnd) - 1;

    if (!section.areas[breakpoint]) {
        section.areas[breakpoint] = [];
    }

    const existingAreaIndex = section.areas[breakpoint].findIndex(a => a.name === areaName);
    const updatedArea = {
        name: areaName,
        startColumn,
        endColumn,
        startRow,
        endRow,
        color: area.style.backgroundColor
    };

    if (existingAreaIndex !== -1) {
        section.areas[breakpoint][existingAreaIndex] = updatedArea;
    } else {
        section.areas[breakpoint].push(updatedArea);
    }

    area.style.gridColumnStart = startColumn;
    area.style.gridColumnEnd = endColumn + 1;
    area.style.gridRowStart = startRow;
    area.style.gridRowEnd = endRow + 1;

    updateCSS();
    saveState();
    saveCurrentState(); // Add this line
}

function updatePreview(section, start, end) {
    if (!start || !end || !start.dataset || !end.dataset) {
        removePreview();
        return;
    }
    
    const startCol = Math.min(parseInt(start.dataset.col), parseInt(end.dataset.col));
    const endCol = Math.max(parseInt(start.dataset.col), parseInt(end.dataset.col));
    const startRow = Math.min(parseInt(start.dataset.row), parseInt(end.dataset.row));
    const endRow = Math.max(parseInt(start.dataset.row), parseInt(end.dataset.row));

    const gridPreview = section.element.querySelector('.grid-preview');
    gridPreview.querySelectorAll('.grid-cell').forEach(cell => {
        const col = parseInt(cell.dataset.col);
        const row = parseInt(cell.dataset.row);
        if (col >= startCol && col <= endCol && row >= startRow && row <= endRow) {
            cell.classList.add('highlighted');
        } else {
            cell.classList.remove('highlighted');
        }
    });
}

function removePreview() {
    document.querySelectorAll('.grid-cell.highlighted').forEach(cell => {
        cell.classList.remove('highlighted');
    });
}

function addArea(section, startCell, endCell, name) {
    if (!startCell || !endCell || !name) {
        console.error('Invalid input for addArea');
        return;
    }

    const startCol = parseInt(startCell.dataset.col);
    const startRow = parseInt(startCell.dataset.row);
    const endCol = parseInt(endCell.dataset.col);
    const endRow = parseInt(endCell.dataset.row);

    if (isNaN(startCol) || isNaN(startRow) || isNaN(endCol) || isNaN(endRow)) {
        console.error('Invalid grid coordinates');
        return;
    }

    if (name.trim() === '') {
        alert('Area name cannot be empty');
        return;
    }

    // Ensure the areas object for the current breakpoint exists
    if (!section.areas[currentBreakpoint]) {
        section.areas[currentBreakpoint] = [];
    }

    // Check if the area name already exists
    const existingArea = section.areas[currentBreakpoint].find(area => area.name === name);
    if (existingArea) {
        alert('An area with this name already exists. Please choose a different name.');
        return;
    }

    const minCol = Math.min(startCol, endCol);
    const maxCol = Math.max(startCol, endCol);
    const minRow = Math.min(startRow, endRow);
    const maxRow = Math.max(startRow, endRow);

    const color = getRandomColor();

    const newArea = {
        name,
        startColumn: minCol,
        startRow: minRow,
        endColumn: maxCol,
        endRow: maxRow,
        color
    };

    ensureAreasForAllBreakpoints(section, newArea);

    renderAreas(section);
    updateCSS();
    saveState();
    saveCurrentState();
}

function ensureAreasForAllBreakpoints(section, area) {
    const breakpointKeys = Object.keys(breakpoints);
    breakpointKeys.forEach(breakpoint => {
        if (!section.areas[breakpoint]) {
            section.areas[breakpoint] = [];
        }
        const existingAreaIndex = section.areas[breakpoint].findIndex(a => a.name === area.name);
        if (existingAreaIndex !== -1) {
            section.areas[breakpoint][existingAreaIndex] = area;
        } else {
            section.areas[breakpoint].push(area);
        }
    });
}

function renameArea(event, section, areaElement) {
    console.log('renameArea function called');
    event.stopPropagation();
    
    const oldName = areaElement.textContent;
    console.log('Old name:', oldName);
    
    const input = document.createElement('input');
    input.type = 'text';
    input.value = oldName;
    input.style.width = '100%';
    input.style.height = '100%';
    input.style.boxSizing = 'border-box';
    input.style.fontSize = window.getComputedStyle(areaElement).fontSize;
    input.style.textAlign = 'center';
    
    areaElement.textContent = '';
    areaElement.appendChild(input);
    input.focus();
    input.select();

    let isRenaming = false;

    function handleRename() {
        if (isRenaming) return;
        isRenaming = true;

        console.log('handleRename function called');
        const newName = input.value.trim();
        console.log('New name:', newName);
        if (newName && newName !== oldName) {
            if (section.areas[currentBreakpoint].some(area => area.name === newName)) {
                alert('An area with this name already exists. Please choose a different name.');
                areaElement.textContent = oldName;
            } else {
                areaElement.textContent = newName;
                
                // Update the area name in the section's areas data for all breakpoints
                for (let bp in section.areas) {
                    const areaData = section.areas[bp].find(a => a.name === oldName);
                    if (areaData) {
                        areaData.name = newName;
                    }
                }
                
                updateCSS();
                saveState();
                saveCurrentState(); // Add this line
                console.log('Area renamed successfully');
            }
        } else {
            areaElement.textContent = oldName;
            console.log('Area name unchanged');
        }

        isRenaming = false;
    }

    input.addEventListener('blur', handleRename);
    input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            input.blur(); // This will trigger the blur event and call handleRename
        }
    });
}

function updateSectionAreas(section, area) {
    const breakpoint = section.currentBreakpoint;
    if (!section.areas[breakpoint]) {
        section.areas[breakpoint] = [];
    }

    const updatedArea = {
        name: area.textContent,
        startColumn: parseInt(area.style.gridColumnStart),
        startRow: parseInt(area.style.gridRowStart),
        endColumn: parseInt(area.style.gridColumnEnd) - 1,
        endRow: parseInt(area.style.gridRowEnd) - 1
    };

    const existingAreaIndex = section.areas[breakpoint].findIndex(a => a.name === updatedArea.name);
    if (existingAreaIndex !== -1) {
        section.areas[breakpoint][existingAreaIndex] = updatedArea;
    } else {
        section.areas[breakpoint].push(updatedArea);
    }
}

function saveState() {
    const state = {
        pages: pages.map(page => ({
            id: page.id,
            name: page.name,
            sections: page.sections.map(section => ({
                ...section,
                element: null // We don't want to store DOM elements
            }))
        })),
        currentPageId: currentPage.id,
        customBreakpoints,
        currentBreakpoint
    };
    
    // Remove future states if we're not at the end of the history
    historyStack = historyStack.slice(0, historyIndex + 1);
    
    historyStack.push(JSON.stringify(state));
    historyIndex = historyStack.length - 1;
    
    if (historyStack.length > MAX_HISTORY) {
        historyStack.shift();
        historyIndex--;
    }
    
    updateUndoRedoButtons();
}

function undo() {
    if (historyIndex > 0) {
        historyIndex--;
        loadState(historyStack[historyIndex]);
    }
    updateUndoRedoButtons();
}

function redo() {
    if (historyIndex < historyStack.length - 1) {
        historyIndex++;
        loadState(historyStack[historyIndex]);
    }
    updateUndoRedoButtons();
}




function updateTabs() {
    const tabsContainer = document.getElementById('page-tabs');
    tabsContainer.innerHTML = '';

    pages.forEach((page, index) => {
        const tab = document.createElement('button');
        tab.textContent = page.name;
        tab.classList.add('page-tab');
        if (page === currentPage) {
            tab.classList.add('active');
        }
        tab.addEventListener('click', () => switchToPage(index));
        tabsContainer.appendChild(tab);
    });

    const addPageTab = document.createElement('button');
    addPageTab.textContent = '+';
    addPageTab.classList.add('add-page-tab');
    addPageTab.addEventListener('click', addNewPage);
    tabsContainer.appendChild(addPageTab);
}

function switchToPage(pageIndex) {
    currentPage = pages[pageIndex];
    renderCurrentPage();
    updateTabs();
    updateCSS();
}

function addNewPage() {
    const newPageName = prompt('Enter new page name:');
    if (newPageName) {
        const newPage = {
            id: `page${pages.length + 1}`,
            name: newPageName,
            sections: []
        };
        pages.push(newPage);
        currentPage = newPage;
        renderCurrentPage();
        updateTabs();
        updateCSS();
    }
}

function renderCurrentPage() {
    sectionsContainer.innerHTML = '';
    currentPage.sections.forEach(section => {
        sectionsContainer.appendChild(section.element);
        createVisualGrid(section);
        renderAreas(section);
    });
    if (currentPage.sections.length > 0) {
        selectSection(currentPage.sections[0]);
    }
}


function loadState(state) {
    const parsedState = JSON.parse(state);
    
    pages = parsedState.pages.map(pageData => ({
        ...pageData,
        sections: pageData.sections.map(sectionData => {
            const section = createSection(sectionData.name, sectionData.columns, sectionData.rows, sectionData.columnSize, sectionData.rowSize, sectionData.gap);
            section.areas = sectionData.areas;
            section.currentBreakpoint = sectionData.currentBreakpoint;
            return section;
        })
    }));
    
    currentPage = pages.find(page => page.id === parsedState.currentPageId);
    customBreakpoints = parsedState.customBreakpoints;
    currentBreakpoint = parsedState.currentBreakpoint;
    
    // Rebuild the UI
    rebuildUI();
}

function rebuildUI() {
    renderCurrentPage();
    updateTabs();
    
    if (currentPage.sections.length > 0) {
        selectSection(currentPage.sections[0]);
    }
    
    updateCSS();
    changeBreakpoint(currentBreakpoint);
}

function updateUndoRedoButtons() {
    if (undoBtn) undoBtn.disabled = historyIndex <= 0;
    if (redoBtn) redoBtn.disabled = historyIndex >= historyStack.length - 1;
}

function createNewLayout() {
    currentPage.sections = []; // Clear existing sections
    sectionsContainer.innerHTML = '';
    createInitialSection(); // Create the initial section
    saveLayoutsToLocalStorage(); // Save the new layout
    localStorage.removeItem('currentGridState'); // Clear the current state
    saveCurrentState(); // Save the new initial state
    updateSidebarControls(currentPage.sections[0]); // Update sidebar controls with the new section
}

// Add custom breakpoint
function addCustomBreakpoint() {
    const name = prompt('Enter breakpoint name:');
    const width = prompt('Enter breakpoint width (in pixels):');
    if (name && width) {
        const breakpointName = name.toLowerCase().replace(/\s+/g, '-');
        customBreakpoints[breakpointName] = `${width}px`;
        const btn = document.createElement('button');
        btn.classList.add('breakpoint-btn');
        btn.dataset.breakpoint = breakpointName;
        btn.textContent = name;
        btn.addEventListener('click', () => changeBreakpoint(breakpointName));
        addBreakpointBtn.insertAdjacentElement('beforebegin', btn);
    }
}

// Initialize the application
document.addEventListener('DOMContentLoaded', function() {
    init();
});

// Add this function to update the sidebar controls
function updateSidebarControls(section) {
    if (!section) return;
    
    const columnsInput = document.getElementById('columns');
    const rowsInput = document.getElementById('rows');
    const gapInput = document.getElementById('gap');
    
    const currentProps = section.gridProperties[currentBreakpoint];
    
    if (columnsInput) columnsInput.value = currentProps.columns;
    if (rowsInput) rowsInput.value = currentProps.rows;
    if (gapInput) {
        const gapValue = parseFloat(currentProps.gap);
        gapInput.value = isNaN(gapValue) ? 1 : gapValue;
    }
}

// Add these functions to your existing JavaScript file

function incrementGap(button) {
    const input = button.parentNode.querySelector('input[type=number]');
    const currentValue = parseFloat(input.value);
    input.value = (currentValue + 0.5).toFixed(1);
    updateGridProperties();
}

function decrementGap(button) {
    const input = button.parentNode.querySelector('input[type=number]');
    const currentValue = parseFloat(input.value);
    if (currentValue > 0) {
        input.value = (currentValue - 0.5).toFixed(1);
        updateGridProperties();
    }
}

// Modify the addGridControlListeners function
function addGridControlListeners() {
    const columnsInput = document.getElementById('columns');
    const rowsInput = document.getElementById('rows');
    const gapInput = document.getElementById('gap');

    if (columnsInput) {
        columnsInput.addEventListener('change', updateGridProperties);
        columnsInput.addEventListener('input', updateGridProperties);
    }
    if (rowsInput) {
        rowsInput.addEventListener('change', updateGridProperties);
        rowsInput.addEventListener('input', updateGridProperties);
    }
    if (gapInput) {
        gapInput.addEventListener('change', updateGridProperties);
        gapInput.addEventListener('input', updateGridProperties);
    }
}

// Add this function to validate input
function validateInput(input, min, max, defaultValue) {
    const value = parseInt(input.value);
    if (isNaN(value) || value < min || value > max) {
        input.value = defaultValue;
        return defaultValue;
    }
    return value;
}

// Modify the updateGridProperties function
function updateGridProperties() {
    if (!selectedSection) return;

    const columns = validateInput(document.getElementById('columns'), 1, 24, 12);
    const rows = validateInput(document.getElementById('rows'), 1, 24, 6);
    const gapValue = parseFloat(document.getElementById('gap').value);
    const gap = isNaN(gapValue) ? '1rem' : `${gapValue}rem`;

    if (!selectedSection.gridProperties[currentBreakpoint]) {
        selectedSection.gridProperties[currentBreakpoint] = {};
    }

    // Update the grid properties for the current breakpoint
    selectedSection.gridProperties[currentBreakpoint] = {
        columns,
        rows,
        gap,
        columnSize: `repeat(${columns}, 1fr)`,
        rowSize: `repeat(${rows}, 1fr)`
    };

    // Update the selected section's properties
    selectedSection.columns = columns;
    selectedSection.rows = rows;
    selectedSection.gap = gap;
    selectedSection.columnSize = `repeat(${columns}, 1fr)`;
    selectedSection.rowSize = `repeat(${rows}, 1fr)`;

    // Update the grid preview directly
    const gridPreview = selectedSection.element.querySelector('.grid-preview');
    gridPreview.style.gap = gap;

    // Update areas to fit within new grid size
    if (selectedSection.areas[currentBreakpoint]) {
        selectedSection.areas[currentBreakpoint] = selectedSection.areas[currentBreakpoint].map(area => ({
            ...area,
            startColumn: Math.min(area.startColumn, columns),
            endColumn: Math.min(area.endColumn, columns),
            startRow: Math.min(area.startRow, rows),
            endRow: Math.min(area.endRow, rows)
        }));
    }

    updateSectionGrid(selectedSection);
    renderAreas(selectedSection);
    updateCSS();
    saveState();
    saveCurrentState(); // Add this line
}

// Ensure the changeBreakpoint function correctly updates the grid properties for the selected section
function changeBreakpoint(breakpoint) {
    const oldBreakpoint = currentBreakpoint;
    currentBreakpoint = breakpoint;
    
    const gridContainer = document.querySelector('.grid-container');
    if (!gridContainer) {
        console.error("gridContainer not found");
        return;
    }
    
    updateBreakpointButtons();
    
    const width = getBreakpointWidth(breakpoint);
    
    // Add transition class
    gridContainer.classList.add('transitioning');
    
    if (width === 'flex-grow') {
        gridContainer.style.width = '100%';
        gridContainer.style.maxWidth = '100%';
    } else {
        gridContainer.style.width = width;
        gridContainer.style.maxWidth = width;
    }
    
    // Update areas for each section
    pages.forEach(page => {
        page.sections.forEach(section => {
            if (!section.gridProperties[breakpoint]) {
                const defaultProps = getDefaultProperties(breakpoint);
                section.gridProperties[breakpoint] = {
                    columns: defaultProps.columns,
                    rows: defaultProps.rows,
                    gap: defaultProps.gap,
                    columnSize: `repeat(${defaultProps.columns}, 1fr)`,
                    rowSize: `repeat(${defaultProps.rows}, 1fr)`
                };
            }
            if (!section.areas[breakpoint]) {
                section.areas[breakpoint] = JSON.parse(JSON.stringify(section.areas['default'] || []));
            }
            updateSectionForBreakpoint(section, breakpoint);
            updateSectionGrid(section);
            renderAreas(section);
        });
    });
    
    if (selectedSection) {
        updateSidebarControls(selectedSection);
    }
    
    // Remove transition class after animation completes
    setTimeout(() => {
        gridContainer.classList.remove('transitioning');
    }, 300);
    
    updateCSS();
    
    // Trigger a custom event for breakpoint change
    const event = new CustomEvent('breakpointChanged', { 
        detail: { oldBreakpoint, newBreakpoint: breakpoint } 
    });
    document.dispatchEvent(event);
}

// Ensure the updateSectionForBreakpoint function correctly updates the grid properties for the selected section
function updateSectionForBreakpoint(section, breakpoint) {
    if (!section.gridProperties[breakpoint]) {
        const defaultProps = getDefaultProperties(breakpoint);
        section.gridProperties[breakpoint] = {
            columns: defaultProps.columns,
            rows: defaultProps.rows,
            gap: defaultProps.gap,
            columnSize: `repeat(${defaultProps.columns}, 1fr)`,
            rowSize: `repeat(${defaultProps.rows}, 1fr)`
        };
    }
    if (!section.areas[breakpoint]) {
        section.areas[breakpoint] = JSON.parse(JSON.stringify(section.areas['default'] || []));
    }

    // Update grid properties
    const gridProperties = section.gridProperties[breakpoint];
    section.columns = gridProperties.columns;
    section.rows = gridProperties.rows;
    section.gap = gridProperties.gap;
    section.columnSize = gridProperties.columnSize;
    section.rowSize = gridProperties.rowSize;

    // Adjust areas to fit within the new grid dimensions
    section.areas[breakpoint] = section.areas[breakpoint].map(area => ({
        ...area,
        startColumn: Math.min(area.startColumn, section.columns),
        endColumn: Math.min(area.endColumn, section.columns),
        startRow: Math.min(area.startRow, section.rows),
        endRow: Math.min(area.endRow, section.rows)
    }));

    // Update visual grid
    createVisualGrid(section);

    // Update areas
    renderAreas(section);
}

// Initialize the application
document.addEventListener('DOMContentLoaded', function() {
    init();
});

function saveCurrentState() {
    const state = {
        pages: pages.map(page => ({
            id: page.id,
            name: page.name,
            sections: page.sections.map(section => ({
                name: section.name,
                columns: section.columns,
                rows: section.rows,
                columnSize: section.columnSize,
                rowSize: section.rowSize,
                gap: section.gap,
                areas: section.areas,
                gridProperties: section.gridProperties
            }))
        })),
        currentPageId: currentPage.id,
        currentBreakpoint: currentBreakpoint
    };
    localStorage.setItem('currentGridState', JSON.stringify(state));
}

function loadCurrentState() {
    const savedState = localStorage.getItem('currentGridState');
    if (savedState) {
        try {
            const state = JSON.parse(savedState);
            if (state && state.pages) {
                pages = state.pages.map(pageData => ({
                    id: pageData.id,
                    name: pageData.name,
                    sections: pageData.sections.map(sectionData => {
                        const section = createSection(sectionData.name, sectionData.columns, sectionData.rows, sectionData.columnSize, sectionData.rowSize, sectionData.gap);
                        section.areas = sectionData.areas;
                        section.gridProperties = sectionData.gridProperties || {
                            'default': {
                                columns: sectionData.columns,
                                rows: sectionData.rows,
                                gap: sectionData.gap,
                                columnSize: sectionData.columnSize,
                                rowSize: sectionData.rowSize
                            }
                        };
                        return section;
                    })
                }));
                currentPage = pages.find(page => page.id === state.currentPageId) || pages[0];
                currentBreakpoint = state.currentBreakpoint || 'desktop-large';
                return true;
            }
        } catch (error) {
            console.error('Error parsing saved state:', error);
        }
    }
    // If no valid state was loaded, initialize with default values
    pages = [{ id: 'page1', name: 'Page 1', sections: [] }];
    currentPage = pages[0];
    currentBreakpoint = 'desktop-large';
    return false;
}

