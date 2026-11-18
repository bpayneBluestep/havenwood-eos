// @vitest-environment jsdom
import {afterEach,it,expect} from 'vitest'
import {cleanup,render,screen} from '@testing-library/react'
import {notesFromEditor} from './RichNotesEditor'
import {NotesPreview} from './NotesText'
import {readNotesDocument} from './notesDocument'
afterEach(cleanup)
it('retains bold, italic and list structure without asterisks',()=>{const root=document.createElement('div');root.innerHTML='<p><b>Bold <i>and italic</i></b></p><ul><li>Bullet</li></ul><ol><li>Number</li></ol>';const saved=notesFromEditor(root);render(<NotesPreview text={saved}/>);expect(screen.getByText('and italic').tagName).toBe('EM');expect(screen.getByText('and italic').parentElement?.tagName).toBe('STRONG');expect(screen.getAllByRole('list')).toHaveLength(2);expect(document.body.textContent).not.toContain('*')})
it('drops unsafe elements and all attributes from the document',()=>{const root=document.createElement('div');root.innerHTML='<p onclick="alert(1)">Safe<script>bad()</script><img src=x onerror="alert(1)"><a href="javascript:alert(1)"> text</a></p>';const saved=notesFromEditor(root);expect(saved).not.toMatch(/onclick|script|onerror|href|bad\(/);render(<NotesPreview text={saved}/>);expect(screen.getByText('Safe text')).toBeTruthy()})
it('opens existing Markdown as formatted text',()=>{render(<NotesPreview text={'**Old bold**\n- Existing list'}/>);expect(screen.getByText('Old bold').tagName).toBe('STRONG');expect(screen.getByRole('listitem').textContent).toBe('Existing list')})
it('does not render an unapproved document node',()=>{expect(readNotesDocument('tenk-rich-notes-v1:[{"tag":"script","children":["bad()"]}]')).toBeNull()})
