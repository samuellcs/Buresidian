// Centralização dos tipos de nós personalizados para ReactFlow
import NoteNode from './NoteNode';
import TextNode from './TextNode';
import ImageNode from './ImageNode';
import LinkNode from './LinkNode';
import GroupNode from './GroupNode';

const CanvasNodeTypes = {
  note: NoteNode,
  text: TextNode,
  image: ImageNode,
  link: LinkNode,
  group: GroupNode,
};

export default CanvasNodeTypes;
