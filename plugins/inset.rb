module Jekyll
  class Inset < Liquid::Block
    def initialize(tag_name, markup, tokens)
      super

      @title = markup.strip
    end

    def render(context)
      %Q{<div class="inset"><h4>#{@title}</h4><p>#{super}</p></div>}
    end
  end
end

Liquid::Template.register_tag('inset', Jekyll::Inset)
